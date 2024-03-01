import os
import json
import time
import datetime

import click
import boto3
from tqdm import tqdm
from InquirerPy import inquirer
from InquirerPy.base.control import Choice

from resource_collector import get_config, get_resources, cw_custom_namespace_retriever, router

class App():
    def __init__(self, profile=None):
        self.session = boto3.session.Session(profile_name=profile)

    def get_active_regions(self, days=30, threshold=1):
        """ Retrieve from Cost Explorer the list of regions where spend is over threshold
        """
        client =  self.session.client('ce')
        end = datetime.datetime.utcnow().date()
        start = end - datetime.timedelta(days=days)
        response = client.get_cost_and_usage(
            TimePeriod={
                'Start': start.strftime('%Y-%m-%d'),
                'End': end.strftime('%Y-%m-%d')
            },
            Granularity='DAILY',
            Metrics=['UnblendedCost'],
            GroupBy=[
                {
                    'Type': 'DIMENSION',
                    'Key': 'SERVICE'
                },
                {
                    'Type': 'DIMENSION',
                    'Key': 'REGION'
                }
            ]
        )
        region_spend = {}
        for result in response['ResultsByTime']:
            for group in result['Groups']:
                if len(group['Keys']) > 1:
                    region = group['Keys'][1]
                    service = group['Keys'][0]
                    amount = group['Metrics']['UnblendedCost']['Amount']
                    if region == 'global':
                        continue
                    if region not in region_spend:
                        region_spend[region] = 0
                    region_spend[region] += float(amount)
        return [region for region, amount in region_spend.items() if amount > threshold]

    def get_regions(self, default=None):
        ec2_client =  self.session.client('ec2')
        all_regions = [region['RegionName'] for region in ec2_client.describe_regions()['Regions']]
        if default is None:
            try:
                default = get_active_regions() + ['us-east-1']
            except:
                default = ['us-east-1']
        return inquirer.checkbox(
            message="Select regions:",
            choices=sorted([Choice(value=name, enabled=name in default) for name in all_regions], key=lambda x: str(int(x.enabled)) + x.value, reverse=True),
            cycle=False,
        ).execute()

    def get_tag_key(self, default=None):
        resource_tagging_api =  self.session.client('resourcegroupstaggingapi')
        tag_keys = list(resource_tagging_api.get_paginator('get_tag_keys').paginate().search('TagKeys'))
        return inquirer.fuzzy(
            message="Select Tag Key:",
            choices=[Choice(value=name) for name in tag_keys],
            default=default,
        ).execute()

    def get_tag_values(self, key, default=None):
        resource_tagging_api =  self.session.client('resourcegroupstaggingapi')
        tag_values = list(resource_tagging_api.get_paginator('get_tag_values').paginate(Key=key).search('TagValues'))
        default = default or []
        return inquirer.checkbox(
            message=f"Select Tag {key} Value :",
            choices=[Choice(value=name, enabled=name in default) for name in tag_values],
            cycle=False,
        ).execute()

    def account_id(self):
        return self.session.client('sts').get_caller_identity()['Account']


@click.command()
@click.option('--regions', default=None, help='Comma Separated list of regions')
@click.option('--tag', default=None, help='a Tag name')
@click.option('--values', default=None, help='Comma Separated list of values')
@click.option('--config-file', default=None, help='Json config file', type=click.Path())
@click.option('--output-file', default="./resources.json", help='output file', type=click.Path())
@click.option('--custom-namespaces-file', default="./custom_namespaces.json", help='custom_namespaces file', type=click.Path())
@click.option('--base-name', default=None, help='Base Name')
@click.option('--grouping-tag-key', default=None, help='GroupingTagKey')
@click.option('--profile', default=None, help='Profile')
def main(base_name, regions, tag, values, config_file, output_file, custom_namespaces_file, grouping_tag_key, profile):
    """ Main """
    app = App(profile)
    if not config_file and os.path.exists("lib/config.json"):
        config_file = "lib/config.json"
    main_config = {}
    if config_file:
        print(f'reading from {config_file}')
        main_config = json.load(open(config_file))
        base_name = base_name or main_config.get('BaseName')
        grouping_tag_key = grouping_tag_key or main_config.get('GroupingTagKey')
        regions = regions or main_config.get('Regions')
        tag = tag or main_config.get('TagKey')
        values = values or main_config.get('TagValues')
        output_file = output_file or main_config.get('ResourceFile')
    base_name = inquirer.text('Enter BaseName', default=base_name or 'Application').execute()
    regions = app.get_regions(default=regions)
    tag = app.get_tag_key(default=tag)
    values = app.get_tag_values(tag, default=values or [])

    need_scan = True
    decorated_resources = []
    region_namespaces = {'RegionNamespaces': []}
    if os.path.exists(output_file):

        choice = inquirer.select(
            f'Resources file was updated {time.ctime(os.path.getmtime(output_file))}',
            choices=["Amend/update", "Override", "Skip scan and use previous results"],
            default="Amend/update",
        ).execute()
        if choice == "Amend/update":
            with open(output_file) as _file :
                decorated_resources = json.load(_file)
            account_id = boto3.client('sts').get_caller_identity()['Account']
            # clean from current account resources
            account_id = app.account_id()
            decorated_resources = [resource for resource in decorated_resources if account_id not in resource.get('ResourceARN', '')]
        elif choice == "Override":
            need_scan = True
        else:
            need_scan = False

    if need_scan:
        if 'us-east-1' not in regions:
            regions.append('us-east-1')
            print('Added us-east-1 region for global services')

        for region in tqdm(regions, desc='Regions', leave=False):
            config = get_config(region)
            resources = get_resources(tag, values, app.session, config)
            region_namespace = {'Region': region, 'Namespaces' : cw_custom_namespace_retriever(app.session, config) }
            region_namespaces['RegionNamespaces'].append(region_namespace)
            for resource in tqdm(resources, desc='Resources', leave=False):
                decorated_resources.append(router(resource, app.session, config))

        with open(custom_namespaces_file, "w") as _file:
            json.dump(region_namespaces, _file, indent=4, default=str)
            print(f'custom_namespaces: {output_file}')

        with open(output_file, "w") as _file:
            json.dump(decorated_resources, _file, indent=4, default=str)
            print(f'output: {output_file}')

    config_file = config_file or "lib/config.json"
    with open(config_file, "w") as _file:
        main_config["Regions"] = regions
        main_config["TagKey"] = tag
        main_config["TagValues"] = values
        main_config["ResourceFile"] = output_file
        json.dump(main_config, _file, indent=4, default=str)
    print(f'config: {config_file}')

    if not os.path.exists('node_modules') and inquirer.confirm(f'Looks like node dependencies are not installed. Run `npm ic` ?', default=True).execute():
        os.system('npm ic')

    if inquirer.confirm(f'Run `cdk synth` ?', default=True).execute():
        os.system('cdk synth')

        if inquirer.confirm(f'Run `cdk deploy` ?', default=True).execute():
            os.system('cdk deploy')

if __name__ == '__main__':
    main()
