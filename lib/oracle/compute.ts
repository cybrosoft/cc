// FILE: lib/oracle/compute.ts

import * as core from "oci-core";
import { getOracleProvider } from "./client";

export type OracleAdminSummary = {
  name: string | null;
  status: string | null;
  ipv4: string | null;
  privateIp: string | null;
  networkName: string | null;
  subnetId: string | null;
  macAddress: string | null;
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
  privateIp: string | null;
  networkName: string | null;
  subnetId: string | null;
  macAddress: string | null;
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
    return { ip: null, privateIp: null, networkName: null, subnetId: null, macAddress: null, ipv4Reserved: null, hasPrivateNetwork: null, firewallExists: null, additionalIps: [] };
  }

  const primaryVnicId    = attachments[0]?.vnicId ?? null;
  const secondaryVnicIds = attachments.slice(1).map(a => a.vnicId).filter((v): v is string => !!v);

  if (!primaryVnicId) {
    return { ip: null, privateIp: null, networkName: null, subnetId: null, macAddress: null, ipv4Reserved: null, hasPrivateNetwork: null, firewallExists: null, additionalIps: [] };
  }

  const primaryVnicResp = await args.vcn.getVnic({ vnicId: primaryVnicId });
  const vnic            = primaryVnicResp.vnic;

  const publicIp   = vnic.publicIp   ?? null;
  const privateIp  = vnic.privateIp  ?? null;
  const ip         = publicIp ?? privateIp;
  const networkName = vnic.displayName ?? null;
  const subnetId   = vnic.subnetId   ?? null;
  const macAddress = vnic.macAddress ?? null;

  const nsgIds         = vnic.nsgIds;
  const firewallExists = Array.isArray(nsgIds) ? nsgIds.length > 0 : null;

  // Determine if the public IP is reserved.
  // Get the Public IP object attached to the primary private IP — it has a lifetime field:
  //   RESERVED  → IP persists after instance termination
  //   EPHEMERAL → IP is lost when instance is terminated
  let ipv4Reserved: boolean | null = null;
  if (publicIp && privateIp) {
    try {
      // First get the private IP object ID from the private IP address
      const privateIpList = await args.vcn.listPrivateIps({
        vnicId: primaryVnicId,
      });
      const privateIpObj = privateIpList.items?.find(p => p.ipAddress === privateIp);
      if (privateIpObj?.id) {
        // Get the public IP assigned to this private IP
        const pubIpResp = await args.vcn.getPublicIpByPrivateIpId({
          getPublicIpByPrivateIpIdDetails: { privateIpId: privateIpObj.id },
        });
        const lifetime = pubIpResp.publicIp?.lifetime;
        if (lifetime === core.models.PublicIp.Lifetime.Reserved) {
          ipv4Reserved = true;
        } else if (lifetime === core.models.PublicIp.Lifetime.Ephemeral) {
          ipv4Reserved = false;
        }
      }
    } catch {
      // If call fails (e.g. no public IP assigned), default to null
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
    privateIp,
    networkName,
    subnetId,
    macAddress,
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
  const compute    = buildComputeClient(args.regionCode);
  const instanceId = args.instanceOcid.trim();
  const response   = await compute.getInstance({ instanceId });
  const inst       = response.instance;
  const shapeCfg   = inst.shapeConfig ?? null;

  const base: OracleAdminSummary = {
    name:                 inst.displayName ?? null,
    status:               inst.lifecycleState ? String(inst.lifecycleState) : null,
    ipv4:                 null,
    privateIp:            null,
    networkName:          null,
    subnetId:             null,
    macAddress:           null,
    ipv4Reserved:         null,
    additionalIps:        [],
    location:             args.regionCode,
    vcpu:                 typeof shapeCfg?.vcpus === "number" ? shapeCfg.vcpus : typeof shapeCfg?.ocpus === "number" ? shapeCfg.ocpus * 2 : null,
    ramGb:                typeof shapeCfg?.memoryInGBs === "number" ? shapeCfg.memoryInGBs : null,
    diskGb:               null,
    additionalDiskGb:     null,
    backupBootExists:     null,
    backupBlockExists:    null,
    snapshotExists:       null,
    firewallExists:       null,
    privateNetworkExists: null,
    volumesExists:        null,
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
    compartmentOcid: compartmentId,
    bootVolumeId:    volumeData.bootVolumeId,
    volumeIds:       volumeData.volumeIds,
  });

  return {
    ...base,
    ipv4:                 netData.ip,
    privateIp:            netData.privateIp,
    networkName:          netData.networkName,
    subnetId:             netData.subnetId,
    macAddress:           netData.macAddress,
    ipv4Reserved:         netData.ipv4Reserved,
    additionalIps:        netData.additionalIps,
    firewallExists:       netData.firewallExists,
    privateNetworkExists: netData.hasPrivateNetwork,
    diskGb:               volumeData.diskGb,
    additionalDiskGb:     volumeData.additionalDiskGb,
    volumesExists:        volumeData.volumesExists,
    backupBootExists:     backupData.backupBootExists,
    backupBlockExists:    backupData.backupBlockExists,
    snapshotExists:       null,
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


// ─── Oracle Custom Images (equivalent of snapshots) ──────────────────────────
export type OracleImageItem = {
  id: string;
  description: string | null;
  created: string;
  status: string | null;
  sizeGb: number | null;
};

export async function listOracleCustomImages(args: {
  instanceOcid: string;
  regionCode: string;
  compartmentOcid: string;
}): Promise<OracleImageItem[]> {
  const compute = buildComputeClient(args.regionCode);

  // Filter by operatingSystem="Custom" — Oracle sets this for all user-created custom images
  const resp = await compute.listImages({
    compartmentId:   args.compartmentOcid,
    lifecycleState:  core.models.Image.LifecycleState.Available,
    operatingSystem: "Custom",
  });

  const images = resp.items ?? [];
  const results: OracleImageItem[] = [];

  for (const img of images) {

    const sizeGb = typeof img.sizeInMBs === "number"
      ? Math.round((img.sizeInMBs / 1024) * 100) / 100
      : null;

    // Build description: "image-name (OS Version)" if OS info available
    const osInfo = [img.operatingSystem, img.operatingSystemVersion].filter(Boolean).join(" ");
    const description = osInfo
      ? `${img.displayName ?? "Custom Image"} (${osInfo})`
      : (img.displayName ?? "Custom Image");

    results.push({
      id:          String(img.id ?? ""),
      description,
      created:     img.timeCreated ? img.timeCreated.toISOString() : new Date().toISOString(),
      status:      img.lifecycleState ? String(img.lifecycleState).toLowerCase() : null,
      sizeGb,
    });
  }

  results.sort((a, b) => b.created.localeCompare(a.created));
  return results.slice(0, 5);
}

// ─── Oracle Security List rules mapped to FwRule shape ────────────────────────
export type OracleFwRule = {
  direction: "in" | "out";
  protocol: string;       // tcp, udp, icmp, all
  port: string | null;    // destination port range e.g. "22" or "8000-9000"
  sourceIps: string[];
  destinationIps: string[];
  description: string | null;
};

export type OracleFirewall = {
  id: string;   // security list OCID
  name: string;
  rules: OracleFwRule[];
};

// Oracle protocol numbers → names
function protoName(proto: string | undefined): string {
  if (!proto) return "all";
  switch (proto) {
    case "6":   return "tcp";
    case "17":  return "udp";
    case "1":   return "icmp";
    case "all": return "all";
    default:    return proto;
  }
}

function portRange(range: { min?: number; max?: number } | null | undefined): string | null {
  if (!range) return null;
  const min = range.min;
  const max = range.max;
  if (min == null && max == null) return null;
  if (min === max) return String(min);
  if (min != null && max != null) return `${min}-${max}`;
  return String(min ?? max);
}

export async function getOracleSecurityRules(args: {
  instanceOcid: string;
  regionCode: string;
  compartmentOcid: string;
}): Promise<OracleFirewall[]> {
  const compute = buildComputeClient(args.regionCode);
  const vcn     = buildVcnClient(args.regionCode);

  // 1. Get primary VNIC attachment
  const vnicAtt = await compute.listVnicAttachments({
    compartmentId: args.compartmentOcid,
    instanceId:    args.instanceOcid,
  });
  const primaryVnicId = vnicAtt.items?.[0]?.vnicId ?? null;
  if (!primaryVnicId) return [];

  // 2. Get VNIC → subnet OCID
  const vnicResp = await vcn.getVnic({ vnicId: primaryVnicId });
  const subnetId = vnicResp.vnic.subnetId ?? null;
  if (!subnetId) return [];

  // 3. Get subnet → security list OCIDs
  const subnetResp     = await vcn.getSubnet({ subnetId });
  const secListIds     = subnetResp.subnet.securityListIds ?? [];
  if (secListIds.length === 0) return [];

  // 4. Fetch each security list and map rules
  const firewalls: OracleFirewall[] = [];

  for (const secListId of secListIds) {
    const slResp  = await vcn.getSecurityList({ securityListId: secListId });
    const sl      = slResp.securityList;
    const rules: OracleFwRule[] = [];

    // Ingress rules
    for (const r of sl.ingressSecurityRules ?? []) {
      const proto = protoName(r.protocol);
      let port: string | null = null;
      if (proto === "tcp" && r.tcpOptions?.destinationPortRange) {
        port = portRange(r.tcpOptions.destinationPortRange);
      } else if (proto === "udp" && r.udpOptions?.destinationPortRange) {
        port = portRange(r.udpOptions.destinationPortRange);
      }
      rules.push({
        direction:      "in",
        protocol:       proto,
        port,
        sourceIps:      r.source ? [r.source] : [],
        destinationIps: [],
        description:    r.description ?? null,
      });
    }

    // Egress rules
    for (const r of sl.egressSecurityRules ?? []) {
      const proto = protoName(r.protocol);
      let port: string | null = null;
      if (proto === "tcp" && r.tcpOptions?.destinationPortRange) {
        port = portRange(r.tcpOptions.destinationPortRange);
      } else if (proto === "udp" && r.udpOptions?.destinationPortRange) {
        port = portRange(r.udpOptions.destinationPortRange);
      }
      rules.push({
        direction:      "out",
        protocol:       proto,
        port,
        sourceIps:      [],
        destinationIps: r.destination ? [r.destination] : [],
        description:    r.description ?? null,
      });
    }

    firewalls.push({
      id:    secListId,
      name:  sl.displayName ?? "Security List",
      rules,
    });
  }

  return firewalls;
}

// ─── Update Oracle Security List rules ───────────────────────────────────────
export async function setOracleSecurityRules(args: {
  instanceOcid: string;
  regionCode: string;
  compartmentOcid: string;
  rules: OracleFwRule[];
}): Promise<void> {
  const compute = buildComputeClient(args.regionCode);
  const vcn     = buildVcnClient(args.regionCode);

  // 1. Get primary VNIC → subnet
  const vnicAtt = await compute.listVnicAttachments({
    compartmentId: args.compartmentOcid,
    instanceId:    args.instanceOcid,
  });
  const primaryVnicId = vnicAtt.items?.[0]?.vnicId ?? null;
  if (!primaryVnicId) throw new Error("No VNIC found for instance");

  const vnicResp = await vcn.getVnic({ vnicId: primaryVnicId });
  const subnetId = vnicResp.vnic.subnetId ?? null;
  if (!subnetId) throw new Error("No subnet found for VNIC");

  // 2. Get security list OCID
  const subnetResp = await vcn.getSubnet({ subnetId });
  const secListId  = subnetResp.subnet.securityListIds?.[0] ?? null;
  if (!secListId) throw new Error("No security list found for subnet");

  // 3. Map FwRule → Oracle ingress/egress rule objects
  const ingressRules: core.models.IngressSecurityRule[] = [];
  const egressRules:  core.models.EgressSecurityRule[]  = [];

  for (const r of args.rules) {
    const protocol = (() => {
      switch (r.protocol) {
        case "tcp":  return "6";
        case "udp":  return "17";
        case "icmp": return "1";
        case "all":  return "all";
        default:     return r.protocol;
      }
    })();

    // Parse port range string e.g. "80" or "8000-9000"
    let tcpUdpOptions: core.models.TcpOptions | core.models.UdpOptions | undefined;
    if ((r.protocol === "tcp" || r.protocol === "udp") && r.port) {
      const parts = r.port.split("-");
      const min   = parseInt(parts[0], 10);
      const max   = parts[1] ? parseInt(parts[1], 10) : min;
      const range = { min, max };
      tcpUdpOptions = r.protocol === "tcp"
        ? { destinationPortRange: range } as core.models.TcpOptions
        : { destinationPortRange: range } as core.models.UdpOptions;
    }

    if (r.direction === "in") {
      const rule: core.models.IngressSecurityRule = {
        protocol,
        source:      r.sourceIps[0] ?? "0.0.0.0/0",
        sourceType:  core.models.IngressSecurityRule.SourceType.CidrBlock,
        isStateless: false, // always stateful
        description: r.description ?? undefined,
      };
      if (r.protocol === "tcp" && tcpUdpOptions) rule.tcpOptions = tcpUdpOptions as core.models.TcpOptions;
      if (r.protocol === "udp" && tcpUdpOptions) rule.udpOptions = tcpUdpOptions as core.models.UdpOptions;
      ingressRules.push(rule);
    } else {
      const rule: core.models.EgressSecurityRule = {
        protocol,
        destination:     r.destinationIps[0] ?? "0.0.0.0/0",
        destinationType: core.models.EgressSecurityRule.DestinationType.CidrBlock,
        isStateless:     false,
        description:     r.description ?? undefined,
      };
      if (r.protocol === "tcp" && tcpUdpOptions) rule.tcpOptions = tcpUdpOptions as core.models.TcpOptions;
      if (r.protocol === "udp" && tcpUdpOptions) rule.udpOptions = tcpUdpOptions as core.models.UdpOptions;
      egressRules.push(rule);
    }
  }

  // 4. Update security list with new rules
  await vcn.updateSecurityList({
    securityListId: secListId,
    updateSecurityListDetails: {
      ingressSecurityRules: ingressRules,
      egressSecurityRules:  egressRules,
    },
  });
}
