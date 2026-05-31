// FILE: lib/cloud/oracle/compute.ts

import * as core from "oci-core";
import { getOracleProvider } from "./client";

export type OracleAdminSummary = {
  name: string | null;
  status: string | null;
  ipv4: string | null;
  ipv4Reserved: boolean | null;    // true = reserved, false = ephemeral
  additionalIps: string[];         // secondary VNIC public IPs
  location: string | null;
  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;           // boot volume
  additionalDiskGb: number | null; // sum of block volumes

  backupBootExists: boolean | null;
  backupBlockExists: boolean | null;
  snapshotExists: boolean | null;
  firewallExists: boolean | null;
  privateNetworkExists: boolean | null;
  volumesExists: boolean | null;
};

function iaasEndpoint(regionCode: string): string {
  return `https://iaas.${regionCode}.oraclecloud.com`;
}

function buildComputeClient(regionCode: string): core.ComputeClient {
  const provider = getOracleProvider();
  const client   = new core.ComputeClient({ authenticationDetailsProvider: provider });
  client.endpoint = iaasEndpoint(regionCode);
  return client;
}

function buildVcnClient(regionCode: string): core.VirtualNetworkClient {
  const provider = getOracleProvider();
  const client   = new core.VirtualNetworkClient({ authenticationDetailsProvider: provider });
  client.endpoint = iaasEndpoint(regionCode);
  return client;
}

function buildBlockClient(regionCode: string): core.BlockstorageClient {
  const provider = getOracleProvider();
  const client   = new core.BlockstorageClient({ authenticationDetailsProvider: provider });
  client.endpoint = iaasEndpoint(regionCode);
  return client;
}

// Returns primary IP, reserved flag, private network flag, firewall flag
// Also returns secondary VNIC public IPs as additionalIps
async function getVnicDetails(args: {
  compute: core.ComputeClient;
  vcn: core.VirtualNetworkClient;
  compartmentOcid: string;
  instanceOcid: string;
}): Promise<{
  ip: string | null;
  ipv4Reserved: boolean | null;
  hasPrivateNetwork: boolean | null;
  firewallExists: boolean | null;
  additionalIps: string[];
}> {
  const vnicAtt = await args.compute.listVnicAttachments({
    compartmentId: args.compartmentOcid,
    instanceId:    args.instanceOcid,
  });

  const attachments = vnicAtt.items ?? [];
  if (attachments.length === 0) {
    return { ip: null, ipv4Reserved: null, hasPrivateNetwork: null, firewallExists: null, additionalIps: [] };
  }

  // Primary VNIC is typically the first one
  const primaryVnicId   = attachments[0]?.vnicId ?? null;
  const secondaryVnicIds = attachments.slice(1).map(a => a.vnicId).filter((v): v is string => !!v);

  if (!primaryVnicId) {
    return { ip: null, ipv4Reserved: null, hasPrivateNetwork: null, firewallExists: null, additionalIps: [] };
  }

  const primaryVnicResp = await args.vcn.getVnic({ vnicId: primaryVnicId });
  const vnic            = primaryVnicResp.vnic;

  const publicIp  = vnic.publicIp  ?? null;
  const privateIp = vnic.privateIp ?? null;
  const ip        = publicIp ?? privateIp;

  const nsgIds       = vnic.nsgIds;
  const firewallExists = Array.isArray(nsgIds) ? nsgIds.length > 0 : null;

  // Determine if the public IP is reserved — check the public IP object's lifetime
  let ipv4Reserved: boolean | null = null;
  if (publicIp) {
    try {
      // List public IPs assigned to this private IP to check lifetime
      const pubIpList = await args.vcn.listPublicIps({
        compartmentId:  args.compartmentOcid,
        scope:          core.models.ListPublicIpsRequest.Scope.AvailabilityDomain,
        availabilityDomain: vnic.availabilityDomain ?? "",
      });
      const matchedIp = pubIpList.items?.find(p => p.ipAddress === publicIp);
      if (matchedIp) {
        ipv4Reserved = matchedIp.lifetime === core.models.PublicIp.Lifetime.Reserved;
      }
    } catch {
      // fallback — can't determine
      ipv4Reserved = null;
    }
  }

  // Get additional IPs from secondary VNICs
  const additionalIps: string[] = [];
  for (const vnicId of secondaryVnicIds) {
    try {
      const resp  = await args.vcn.getVnic({ vnicId });
      const pubIp = resp.vnic.publicIp ?? null;
      if (pubIp) additionalIps.push(pubIp);
    } catch { /**/ }
  }

  return {
    ip,
    ipv4Reserved,
    hasPrivateNetwork: privateIp ? true : null,
    firewallExists,
    additionalIps,
  };
}

async function getBootDiskAndVolumes(args: {
  compute: core.ComputeClient;
  block: core.BlockstorageClient;
  compartmentOcid: string;
  instanceOcid: string;
}): Promise<{
  diskGb: number | null;
  additionalDiskGb: number | null;
  volumesExists: boolean | null;
  bootVolumeId: string | null;
  volumeIds: string[];
}> {
  const bootAtt = await args.compute.listBootVolumeAttachments({
    compartmentId: args.compartmentOcid,
    instanceId:    args.instanceOcid,
  });
  const bootVolumeId = bootAtt.items?.[0]?.bootVolumeId ?? null;

  let diskGb: number | null = null;
  if (bootVolumeId) {
    const boot = await args.block.getBootVolume({ bootVolumeId });
    const size = boot.bootVolume.sizeInGBs;
    diskGb = typeof size === "number" ? size : null;
  }

  const volAtt  = await args.compute.listVolumeAttachments({
    compartmentId: args.compartmentOcid,
    instanceId:    args.instanceOcid,
  });
  const items = Array.isArray(volAtt.items) ? volAtt.items : [];
  const volumeIds: string[] = items
    .map(v => v.volumeId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  // Fetch size of each additional block volume
  let additionalDiskGb: number | null = null;
  if (volumeIds.length > 0) {
    try {
      const sizes = await Promise.all(
        volumeIds.map(async (volumeId) => {
          const v = await args.block.getVolume({ volumeId });
          const s = v.volume.sizeInGBs;
          return typeof s === "number" ? s : 0;
        })
      );
      additionalDiskGb = sizes.reduce((a, b) => a + b, 0);
    } catch {
      additionalDiskGb = null;
    }
  }

  return {
    diskGb,
    additionalDiskGb,
    volumesExists: items.length > 0,
    bootVolumeId,
    volumeIds,
  };
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
      bootVolumeId:  args.bootVolumeId,
    });
    const items = Array.isArray(bootBackups.items) ? bootBackups.items : null;
    backupBootExists = items ? items.length > 0 : null;
  }

  if (args.volumeIds.length === 0) return { backupBootExists, backupBlockExists: null };

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

  return { backupBootExists, backupBlockExists: checks.some(Boolean) };
}

export async function getOracleInstanceSummary(args: {
  instanceOcid: string;
  regionCode: string;
  compartmentOcid?: string;
}): Promise<OracleAdminSummary> {
  const compute     = buildComputeClient(args.regionCode);
  const instanceId  = args.instanceOcid.trim();
  const response    = await compute.getInstance({ instanceId });
  const inst        = response.instance;
  const shapeCfg    = inst.shapeConfig ?? null;

  const base: OracleAdminSummary = {
    name:             inst.displayName ?? null,
    status:           inst.lifecycleState ? String(inst.lifecycleState) : null,
    ipv4:             null,
    ipv4Reserved:     null,
    additionalIps:    [],
    location:         args.regionCode,
    vcpu:             typeof shapeCfg?.ocpus === "number"        ? shapeCfg.ocpus        : null,
    ramGb:            typeof shapeCfg?.memoryInGBs === "number"  ? shapeCfg.memoryInGBs  : null,
    diskGb:           null,
    additionalDiskGb: null,
    backupBootExists:    null,
    backupBlockExists:   null,
    snapshotExists:      null,
    firewallExists:      null,
    privateNetworkExists: null,
    volumesExists:       null,
  };

  const compartmentId = args.compartmentOcid?.trim();
  if (!compartmentId) return base;

  const vcn   = buildVcnClient(args.regionCode);
  const block = buildBlockClient(args.regionCode);

  const [netData, volumeData] = await Promise.all([
    getVnicDetails({ compute, vcn, compartmentOcid: compartmentId, instanceOcid: instanceId }),
    getBootDiskAndVolumes({ compute, block, compartmentOcid: compartmentId, instanceOcid: instanceId }),
  ]);

  const backupData = await getBackupFlags({
    block,
    compartmentOcid:  compartmentId,
    bootVolumeId:     volumeData.bootVolumeId,
    volumeIds:        volumeData.volumeIds,
  });

  return {
    ...base,
    ipv4:             netData.ip,
    ipv4Reserved:     netData.ipv4Reserved,
    additionalIps:    netData.additionalIps,
    firewallExists:   netData.firewallExists,
    privateNetworkExists: netData.hasPrivateNetwork,
    diskGb:           volumeData.diskGb,
    additionalDiskGb: volumeData.additionalDiskGb,
    volumesExists:    volumeData.volumesExists,
    backupBootExists: backupData.backupBootExists,
    backupBlockExists: backupData.backupBlockExists,
    snapshotExists:   null,
  };
}

export async function rebootOracleInstance(args: {
  instanceOcid: string;
  regionCode: string;
}): Promise<{ requestId: string | null }> {
  const client = buildComputeClient(args.regionCode);
  const resp   = await client.instanceAction({
    instanceId: args.instanceOcid.trim(),
    action:     "RESET",
  });
  const requestId = typeof resp.opcRequestId === "string" && resp.opcRequestId.trim().length > 0
    ? resp.opcRequestId.trim()
    : null;
  return { requestId };
}
