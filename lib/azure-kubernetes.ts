import { Construct } from "constructs";
import { Resource } from "cdktf";
import { AzurermProvider } from './../.gen/providers/azurerm'
import {
  ResourceGroup,
  KubernetesCluster,
  KubernetesClusterIdentity,
  KubernetesClusterDefaultNodePool } from './../.gen/providers/azurerm'

export interface AzureKubernetesProps {
  readonly region: string;
}

export class AzureKubernetesStack extends Resource {
  constructor(scope: Construct, name: string, props: AzureKubernetesProps) {
    super(scope, name);

    new AzurermProvider(this, 'azure', { features: {}});

    const location = props.region

    const resourceGroup = new ResourceGroup(this, 'resource-group', {
      name: 'aws-deployment-anywhere',
      location,
    });

    const identity: KubernetesClusterIdentity = { type: 'SystemAssigned'}

    const defaultNodePool: KubernetesClusterDefaultNodePool = {
      name: 'default',
      vmSize: 'Standard_D2_v2',
      nodeCount: 1
    }

    new KubernetesCluster(this, 'aks', {
      name: 'aws-deployment-anywhere',
      location,
      resourceGroupName: resourceGroup.name,
      kubernetesVersion: '1.22.6',
      identity,
      roleBasedAccessControlEnabled: true,
      dnsPrefix: 'aws-deployment-anywhere',
      defaultNodePool,
    });


  }
}
