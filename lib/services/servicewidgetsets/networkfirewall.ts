import {Construct} from "constructs";
import {WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Row, Statistic, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class NetworkFirewallWidgetSet extends Construct implements WidgetSet {
    namespace: string = 'AWS/NetworkFirewall';
    widgetSet: any = [];
    alarmSet: any = [];
    config: any = {};

    constructor(scope: Construct, id: string, resource: any, config: any) {
        super(scope, id);
        this.config = config;
        const firewallName = resource.ResourceARN.split('/')[resource.ResourceARN.split('/').length - 1];
        const region = resource.ResourceARN.split(':')[3];
        const account = resource.ResourceARN.split(':')[4];
        const vpcId = resource.Firewall['VpcId'];
        console.log(vpcId);
        let azs = [
            `${region}a`,
            `${region}b`,
            `${region}c`,
            `${region}d`,
            `${region}e`,
            `${region}f`
        ];


        let markDown = `#### NetworkFW: [${firewallName}](https://${region}.console.aws.amazon.com/vpc/home?region=${region}#NetworkFirewallDetails:arn=arn_aws_network-firewall_${region}_${account}_firewall~${firewallName}) `

        if ( resource.Firewall['FirewallPolicyArn']){

            let policyName = resource.Firewall['FirewallPolicyArn'].split(':')[5].split('/')[1];
            markDown = `${markDown} Policy: [${policyName}](https://${region}.console.aws.amazon.com/vpcconsole/home?region=${region}#NetworkFirewallPolicyDetails:arn=arn_aws_network-firewall_${region}_${account}_firewall-policy~${policyName})`;
        }

        if ( resource.Firewall['VpcId']){
            markDown = `${markDown} VPC: [${resource.Firewall['VpcId']}](https://${region}.console.aws.amazon.com/vpcconsole/home?region=${region}#vpcs:VpcId=${resource.Firewall['VpcId']})`
        }

        let attachments:any[] = [];
        if ( resource.FirewallStatus['SyncStates'] ){
            console.log(resource.FirewallStatus['SyncStates'])
            console.log(azs);
            let firstAZ = true;
            for (const az of azs ){
                console.log(az);

                if (resource.FirewallStatus['SyncStates'].hasOwnProperty(az)) {
                    console.log(resource.FirewallStatus['SyncStates'][az]);
                    if ( firstAZ ){
                        markDown = `${markDown} AZs:`
                        firstAZ = false;
                    }
                    let attachment:any = resource.FirewallStatus['SyncStates'][az]['Attachment'];
                    const subnetId = attachment['SubnetId'];
                    const endpointId = attachment['EndpointId'];
                    markDown = `${markDown} (${az}[${subnetId}](https://${region}.console.aws.amazon.com/vpcconsole/home?region=${region}#subnets:SubnetId=${subnetId}) /`
                    markDown = `${markDown} [${endpointId}](https://${region}.console.aws.amazon.com/vpcconsole/home?region=${region}#EndpointDetails:vpcEndpointId=${endpointId}))`
                    attachments.push(attachment);
                }
            }
        }

        console.log(attachments);


        this.widgetSet.push(new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        }));

        const receivedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'ReceivedPackets',
            label: 'ReceivedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'ReceivedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const passedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'PassedPackets',
            label: 'PassedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'PassedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });


        const rejectedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'RejectedPackets',
            label: 'RejectedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'RejectedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const droppedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'DroppedPackets',
            label: 'DroppedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'DroppedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const invalidDroppedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'InvalidDroppedPackets',
            label: 'InvalidDroppedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'InvalidDroppedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const otherDroppedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'OtherDroppedPackets',
            label: 'OtherDroppedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'OtherDroppedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const tlsPassedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'TLSPassedPackets',
            label: 'TLSPassedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'TLSPassedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const tlsRejectedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'TLSRejectedPackets',
            label: 'TLSRejectedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'TLSRejectedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const tlsDroppedPackets = new Metric({
            namespace: this.namespace,
            metricName: 'TLSDroppedPackets',
            label: 'TLSDroppedPackets',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'TLSDroppedPackets',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const tlsErrors = new Metric({
            namespace: this.namespace,
            metricName: 'TLSErrors',
            label: 'TLSErrors',
            dimensionsMap: this.getDimensionsByMetricName(resource['Metrics'],'TLSErrors',firewallName),
            statistic: Statistic.SUM,
            period: Duration.minutes(1)
        });

        const receivedPacketsWidget = new GraphWidget({
            title: 'Packets received',
            left:[receivedPackets],
            period: Duration.minutes(1),
            region: region,
            width: 12,
            height: 5
        });

        const packetsWidget = new GraphWidget({
            title: 'Packets passed/rejected',
            left:[passedPackets],
            right:[rejectedPackets],
            period: Duration.minutes(1),
            region: region,
            width: 12,
            height: 5
        });

        const droppedPacketsWidget = new GraphWidget({
            title: 'Packets Dropped/(InvalidDropped/OtherDropped)',
            left:[droppedPackets],
            right:[invalidDroppedPackets,otherDroppedPackets],
            period: Duration.minutes(1),
            region: region,
            width: 8,
            height: 4
        });

        const tlsPassedRejectedWidget = new GraphWidget({
            title: 'tlsPassed/Rejected',
            left:[tlsPassedPackets],
            right:[tlsRejectedPackets],
            period: Duration.minutes(1),
            region: region,
            width: 8,
            height: 4
        });

        const tlsDroppedErrorsWidget = new GraphWidget({
            title: 'tlsDropped/Errors',
            left:[tlsDroppedPackets],
            right:[tlsErrors],
            period: Duration.minutes(1),
            region: region,
            width: 8,
            height: 4
        });


        this.widgetSet.push(new Row(receivedPacketsWidget,packetsWidget));
        this.widgetSet.push(new Row(droppedPacketsWidget,tlsPassedRejectedWidget,tlsDroppedErrorsWidget));
        let vpceRow = new Row()
        if (attachments && attachments.length > 0) {
            const azCount = attachments.length;
            const widthPerAZ = Math.floor(24/azCount);
            for (let attachment of attachments) {
                let widgetSize = Math.floor(widthPerAZ/2);
                const activeConnections = new Metric({
                    namespace: 'AWS/PrivateLinkEndpoints',
                    metricName: 'ActiveConnections',
                    label: 'ActiveConnections',
                    dimensionsMap: {
                        "VPC Id": vpcId,
                        "VPC Endpoint Id": attachment['EndpointId'],
                        "Endpoint Type": "GatewayLoadBalancer",
                        "Subnet Id": attachment['SubnetId'],
                        "Service Name": attachment['ServiceName']
                    },
                    statistic: Statistic.SUM,
                    period: Duration.minutes(1)
                });

                const newConnections = new Metric({
                    namespace: 'AWS/PrivateLinkEndpoints',
                    metricName: 'NewConnections',
                    label: 'NewConnections',
                    dimensionsMap: {
                        "VPC Id": vpcId,
                        "VPC Endpoint Id": attachment['EndpointId'],
                        "Endpoint Type": "GatewayLoadBalancer",
                        "Subnet Id": attachment['SubnetId'],
                        "Service Name": attachment['ServiceName']
                    },
                    statistic: Statistic.SUM,
                    period: Duration.minutes(1)
                });

                const connectionWidget = new GraphWidget({
                    title: `${attachment['EndpointId']} Connections Active/New`,
                    left:[activeConnections],
                    right:[newConnections],
                    period: Duration.minutes(1),
                    region: region,
                    width: widgetSize,
                    height: 4
                });

                vpceRow.addWidget(connectionWidget);

                const bytesProcessed = new Metric({
                    namespace: 'AWS/PrivateLinkEndpoints',
                    metricName: 'BytesProcessed',
                    label: 'BytesProcessed',
                    dimensionsMap: {
                        "VPC Id": vpcId,
                        "VPC Endpoint Id": attachment['EndpointId'],
                        "Endpoint Type": "GatewayLoadBalancer",
                        "Subnet Id": attachment['SubnetId'],
                        "Service Name": attachment['ServiceName']
                    },
                    statistic: Statistic.SUM,
                    period: Duration.minutes(1)
                });

                const packetsDropped = new Metric({
                    namespace: 'AWS/PrivateLinkEndpoints',
                    metricName: 'PacketsDropped',
                    label: 'PacketsDropped',
                    dimensionsMap: {
                        "VPC Id": vpcId,
                        "VPC Endpoint Id": attachment['EndpointId'],
                        "Endpoint Type": "GatewayLoadBalancer",
                        "Subnet Id": attachment['SubnetId'],
                        "Service Name": attachment['ServiceName']
                    },
                    statistic: Statistic.SUM,
                    period: Duration.minutes(1)
                });

                const rstPacketsReceived = new Metric({
                    namespace: 'AWS/PrivateLinkEndpoints',
                    metricName: 'RstPacketsReceived',
                    label: 'RstPacketsReceived',
                    dimensionsMap: {
                        "VPC Id": vpcId,
                        "VPC Endpoint Id": attachment['EndpointId'],
                        "Endpoint Type": "GatewayLoadBalancer",
                        "Subnet Id": attachment['SubnetId'],
                        "Service Name": attachment['ServiceName']
                    },
                    statistic: Statistic.SUM,
                    period: Duration.minutes(1)
                });

                const packetsWidget = new GraphWidget({
                    title: `${attachment['EndpointId']} Bytes Processed/Packets Dropped/RST)`,
                    left:[bytesProcessed],
                    right:[packetsDropped,rstPacketsReceived],
                    period: Duration.minutes(1),
                    region: region,
                    width: widgetSize,
                    height: 4
                });

                vpceRow.addWidget(packetsWidget);

            }

        }
        this.widgetSet.push(vpceRow);

    }

    getDimensionsByMetricName(metricsData: [], metricName: string, firewallName: string):any{
        let dimensionsMap:any;
        const metric:any = metricsData.find(m => {
            return m['MetricName'] === metricName;
        });

        if (metric) {
            dimensionsMap = {};
            // Convert the Dimensions array to an object with the desired format
            for (let dimension of metric.Dimensions){
                dimensionsMap[dimension['Name']] = dimension['Value'];
            }
        } else {
            dimensionsMap = {
                FirewallName: firewallName
            }
        }

        return dimensionsMap;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

}