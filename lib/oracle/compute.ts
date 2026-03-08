// FILE: lib/cloud/oracle/compute.ts

import * as core from "oci-core";
import { getOracleProvider } from "./client";

export type OracleAdminSummary = {
  name: string | null;
  status: string | null;
  ipv4: string | null;
  location: string | null;
  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;

  backupBootExists: boolean | null;
  backupBlockExists: boolean | null;
  snapshotExists: boolean | null; // always null for Oracle
  firewallExists: boolean | null;
  privateNetworkExists: boolean | null;
  volumesExists: boolean | null;
};

function iaasEndpoint(regionCode: string): string {
  return `https://iaas.${regionCode}.oraclecloud.com`;
}

function buildComputeClient(regionCode: string): core.ComputeClient {
  const provider = getOracleProvider();
  const client = new core.ComputeClient({ authenticationDetailsProvider: provider });
  client.endpoint = iaasEndpoint(regionCode);
  return client;
}

function buildVcnClient(regionCode: string): core.VirtualNetworkClient {
  const provider = getOracleProvider();
  const client = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
  client.endpoint = iaasEndpoint(regionCode);
  return client;
}

function buildBlockClient(regionCode: string): core.BlockstorageClient {
  const provider = getOracleProvider();
  const client = new core.BlockstorageClient({ authenticationDetailsProvider: provider });
  client.endpoint = iaasEndpoint(regionCode);
  return client;
}

async function getPrimaryVnicIpAndFirewall(args: {
  compute: core.ComputeClient;
  vcn: core.VirtualNetworkClient;
  compartmentOcid: string;
  instanceOcid: string;
}): Promise<{
  ip: string | null;
  hasPrivateNetwork: boolean | null;
  firewallExists: boolean | null;
}> {
  const vnicReq: core.requests.ListVnicAttachmentsRequest = {
    compartmentId: args.compartmentOcid,
    instanceId: args.instanceOcid,
  };

  const vnicAtt = await args.compute.listVnicAttachments(vnicReq);
  const vnicId = vnicAtt.items?.[0]?.vnicId ?? null;

  if (!vnicId) {
    return { ip: null, hasPrivateNetwork: null, firewallExists: null };
  }

  const vnicResp = await args.vcn.getVnic({ vnicId });

  // Prefer public IP first
  const publicIp = vnicResp.vnic.publicIp ?? null;
  const privateIp = vnicResp.vnic.privateIp ?? null;
  const ip = publicIp ?? privateIp;

  const nsgIds = vnicResp.vnic.nsgIds;
  const firewallExists = Array.isArray(nsgIds) ? nsgIds.length > 0 : null;

  return {
    ip,
    hasPrivateNetwork: privateIp ? true : null,
    firewallExists,
  };
}

async function getBootDiskAndVolumes(args: {
  compute: core.ComputeClient;
  block: core.BlockstorageClient;
  compartmentOcid: string;
  instanceOcid: string;
}): Promise<{
  diskGb: number | null;
  volumesExists: boolean | null;
  bootVolumeId: string | null;
  volumeIds: string[];
}> {
  const bootReq: core.requests.ListBootVolumeAttachmentsRequest = {
    compartmentId: args.compartmentOcid,
    instanceId: args.instanceOcid,
  };

  const bootAtt = await args.compute.listBootVolumeAttachments(bootReq);
  const bootVolumeId = bootAtt.items?.[0]?.bootVolumeId ?? null;

  let diskGb: number | null = null;

  if (bootVolumeId) {
    const boot = await args.block.getBootVolume({ bootVolumeId });
    const size = boot.bootVolume.sizeInGBs;
    diskGb = typeof size === "number" ? size : null;
  }

  const volReq: core.requests.ListVolumeAttachmentsRequest = {
    compartmentId: args.compartmentOcid,
    instanceId: args.instanceOcid,
  };

  const volAtt = await args.compute.listVolumeAttachments(volReq);

  const items = Array.isArray(volAtt.items) ? volAtt.items : null;

  const volumeIds: string[] =
    items?.map((v) => v.volumeId).filter((v): v is string => typeof v === "string" && v.length > 0) ?? [];

  const volumesExists = items ? items.length > 0 : null;

  return { diskGb, volumesExists, bootVolumeId, volumeIds };
}

async function getBackupFlags(args: {
  block: core.BlockstorageClient;
  compartmentOcid: string;
  bootVolumeId: string | null;
  volumeIds: string[];
}): Promise<{ backupBootExists: boolean | null; backupBlockExists: boolean | null }> {
  let backupBootExists: boolean | null = null;

  if (args.bootVolumeId) {
    const bootBackups = await args.block.listBootVolumeBackups({
      compartmentId: args.compartmentOcid,
      bootVolumeId: args.bootVolumeId,
    });

    const items = Array.isArray(bootBackups.items) ? bootBackups.items : null;
    backupBootExists = items ? items.length > 0 : null;
  }

  if (args.volumeIds.length === 0) {
    return { backupBootExists, backupBlockExists: null };
  }

  const checks = await Promise.all(
    args.volumeIds.map(async (volumeId) => {
      const backups = await args.block.listVolumeBackups({
        compartmentId: args.compartmentOcid,
        volumeId,
      });

      const items = Array.isArray(backups.items) ? backups.items : null;
      return items ? items.length > 0 : false;
    })
  );

  const backupBlockExists = checks.some(Boolean);

  return { backupBootExists, backupBlockExists };
}

export async function getOracleInstanceSummary(args: {
  instanceOcid: string;
  regionCode: string;
  compartmentOcid?: string;
}): Promise<OracleAdminSummary> {
  const compute = buildComputeClient(args.regionCode);

  const instanceId = args.instanceOcid.trim();
  const response = await compute.getInstance({ instanceId });
  const inst = response.instance;
  const shapeCfg = inst.shapeConfig ?? null;

  const base: OracleAdminSummary = {
    name: inst.displayName ?? null,
    status: inst.lifecycleState ? String(inst.lifecycleState) : null,
    ipv4: null,
    location: args.regionCode,

    vcpu: typeof shapeCfg?.ocpus === "number" ? shapeCfg.ocpus : null,
    ramGb: typeof shapeCfg?.memoryInGBs === "number" ? shapeCfg.memoryInGBs : null,
    diskGb: null,

    backupBootExists: null,
    backupBlockExists: null,
    snapshotExists: null,
    firewallExists: null,
    privateNetworkExists: null,
    volumesExists: null,
  };

  const compartmentId = args.compartmentOcid?.trim();
  if (!compartmentId) {
    return base;
  }

  const vcn = buildVcnClient(args.regionCode);
  const block = buildBlockClient(args.regionCode);

  const [netData, volumeData] = await Promise.all([
    getPrimaryVnicIpAndFirewall({
      compute,
      vcn,
      compartmentOcid: compartmentId,
      instanceOcid: instanceId,
    }),
    getBootDiskAndVolumes({
      compute,
      block,
      compartmentOcid: compartmentId,
      instanceOcid: instanceId,
    }),
  ]);

  const backupData = await getBackupFlags({
    block,
    compartmentOcid: compartmentId,
    bootVolumeId: volumeData.bootVolumeId,
    volumeIds: volumeData.volumeIds,
  });

  return {
    ...base,
    ipv4: netData.ip,
    firewallExists: netData.firewallExists,
    privateNetworkExists: netData.hasPrivateNetwork,

    diskGb: volumeData.diskGb,
    volumesExists: volumeData.volumesExists,

    backupBootExists: backupData.backupBootExists,
    backupBlockExists: backupData.backupBlockExists,
    snapshotExists: null,
  };
}

export async function rebootOracleInstance(args: {
  instanceOcid: string;
  regionCode: string;
}): Promise<{ requestId: string | null }> {
  const client = buildComputeClient(args.regionCode);

  const resp = await client.instanceAction({
    instanceId: args.instanceOcid.trim(),
    action: "RESET",
  });

  const requestId =
    typeof resp.opcRequestId === "string" && resp.opcRequestId.trim().length > 0
      ? resp.opcRequestId.trim()
      : null;

  return { requestId };
}