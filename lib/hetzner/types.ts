// lib/hetzner/types.ts
export type HetznerError = { status: number; message: string };

export type HetznerServerCore = {
  id: number;
  name: string;
  status: string;

  ipv4: string | null;
  ipv6: string | null;

  location: string | null;

  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;

  outgoingTrafficBytes: number | null;

  firewallActive: boolean | null;
  privateNetworkActive: boolean | null;
  volumesActive: boolean | null;
};

export type HetznerImageItem = {
  id: number;
  type: "backup" | "snapshot";
  description: string | null;
  created: string; // ISO
  status: string | null;
  sizeGb: number | null;
};

export type HetznerFirewallRule = {
  direction: "in" | "out";
  protocol: string;
  port: string | null;
  sourceIps: string[];
  destinationIps: string[];
  description: string | null;
};

export type HetznerFirewallDetails = {
  id: number;
  name: string;
  rules: HetznerFirewallRule[];
};

export type HetznerPrivateNetItem = {
  networkId: number;
  ip: string;
  aliasIps: string[];
  macAddress: string | null;
};

export type HetznerVolumeItem = {
  id: number;
  name: string;
  sizeGb: number | null;
  linuxDevice: string | null;
  format: string | null;
  status: string | null;
};

export type HetznerServerFull = {
  core: HetznerServerCore;
  backups: HetznerImageItem[]; // max 7
  snapshots: HetznerImageItem[]; // max 5
  firewalls: HetznerFirewallDetails[];
  privateNetworks: HetznerPrivateNetItem[];
  volumes: HetznerVolumeItem[];
};