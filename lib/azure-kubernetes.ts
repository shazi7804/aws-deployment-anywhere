import { Construct } from "constructs";
import { TerraformStack } from "cdktf";
import {
  ResourceGroup,
  KubernetesCluster,
  // KubernetesClusterConfig,
  // KubernetesClusterServicePrincipal,
  KubernetesClusterRoleBasedAccessControl,
  KubernetesClusterIdentity,
  KubernetesClusterNetworkProfile,
  KubernetesClusterAddonProfile,
  KubernetesClusterAddonProfileKubeDashboard,
  KubernetesClusterDefaultNodePool } from '../.gen/providers/azurerm'

export interface AzureKubernetesProps {
  readonly region: string;
}

export class AzureKubernetesStack extends TerraformStack {
  constructor(scope: Construct, name: string, props: AzureKubernetesProps) {
    super(scope, name);

    const location = props.region

    const resourceGroup = new ResourceGroup(this, 'resource-group', {
      name: 'aws-deployment-anywhere',
      location,
    });

    const identity: KubernetesClusterIdentity = { type: 'SystemAssigned'}
    const roleBasedAccessControl: KubernetesClusterRoleBasedAccessControl = { enabled: true }

    // const pool: az.KubernetesClusterDefaultNodePool = {
    //   name: 'default',
    //   vmSize: 'Standard_D2_v2',
    //   nodeCount: 1
    // }

    // Addon Profile
    const addonProfileKubeDashboard: KubernetesClusterAddonProfileKubeDashboard = { enabled: true } 
    const addonProfile: KubernetesClusterAddonProfile = {
        kubeDashboard: addonProfileKubeDashboard
    }

    const defaultNodePool: KubernetesClusterDefaultNodePool = {
      name: 'default',
      vmSize: 'Standard_D2_v2',
      nodeCount: 1
    }

    // const ident: az.KubernetesClusterServicePrincipal = {
    //   clientId: process.env.AZ_SP_CLIENT_ID as string,
    //   clientSecret: process.env.AZ_SP_CLIENT_SECRET as string
    // }

    const aks = new KubernetesCluster(this, 'aks', {
      name: 'aws-deployment-anywhere',
      location,
      resourceGroupName: resourceGroup.name,
      kubernetesVersion: '1.22.6',
      identity,
      roleBasedAccessControl,
      addonProfile,
      dnsPrefix: 'aws-deployment-anywhere',
      defaultNodePool: defaultNodePool,
      // dependsOn: [resourceGroup.name, azureKubernetesDefaultPool, props.azureNetwork],
  });


  }
}
