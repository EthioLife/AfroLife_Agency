const command = Buffer.from('zINSTREAM\0', 'ascii');

export function completeClamAvStream(buffer) {
  if (buffer.length < command.length) return undefined;
  if (!buffer.subarray(0, command.length).equals(command)) return false;

  let offset = command.length;
  while (offset < buffer.length) {
    if (buffer.length - offset < 4) return undefined;
    const size = buffer.readUInt32BE(offset);
    offset += 4;
    if (size === 0) return offset === buffer.length;
    if (buffer.length - offset < size) return undefined;
    offset += size;
  }
  return undefined;
}
