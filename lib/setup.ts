// The owner's hostel setup (Settings → Hostel setup): rents, blocks, meal cut-offs, rooms and beds.
// Each call goes to an owner-only database function (db/migrations/016), then loads the hostel again in place so every
// screen shows the new setup. Other open devices load it again on their next pull.
import { neon, errorText } from "./neon";
import { reloadOrg } from "./session";
import type { Gender, Meal, RoomType } from "@/data";

export const ROOM_TYPES: RoomType[] = ["single", "double", "triple", "six"];
export const CAPACITY: Record<RoomType, number> = { single: 1, double: 2, triple: 3, six: 6 };

export interface BlockSetup { id: string; name: string; gender: Gender; curfew: string }

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await neon().rpc(fn, args);
  if (error) throw new Error(errorText(error));
  await reloadOrg();
  return data as T;
}

export const setRents = (orgId: string, rents: Record<RoomType, number>) => call<Record<RoomType, number>>("set_rents", { p_org: orgId, p_rents: rents });
export const setBlocks = (orgId: string, blocks: BlockSetup[]) => call<BlockSetup[]>("set_blocks", { p_org: orgId, p_blocks: blocks });
/** Cut-offs as stored: "10:00", or "21:00 previous day". */
export const setCutoffs = (orgId: string, cutoffs: Record<Meal, string>) => call<Record<Meal, string>>("set_cutoffs", { p_org: orgId, p_cutoffs: cutoffs });
export const addRoom = (orgId: string, room: { block: string; floor: number; number: string; type: RoomType }) =>
  call<string>("add_room", { p_org: orgId, p_block: room.block, p_floor: room.floor, p_number: room.number, p_type: room.type });
export const setRoomType = (orgId: string, roomId: string, type: RoomType) => call<null>("set_room", { p_org: orgId, p_room: roomId, p_type: type });
export const removeRoom = (orgId: string, roomId: string) => call<null>("remove_room", { p_org: orgId, p_room: roomId });

/** The next free block letter, or null when A to Z are all used. */
export function nextBlockId(ids: string[]) {
  for (let c = 65; c <= 90; c++) if (!ids.includes(String.fromCharCode(c))) return String.fromCharCode(c);
  return null;
}
