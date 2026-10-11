export interface SessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

export interface IceCandidate {
  candidate: string;
  sdpMid: string | null;
  sdpMLineIndex: number | null;
}

export type IncomingMessage =
  | { type: 'matched'; match: string; offer: boolean }
  | { type: 'on-going-call' | 'peer-left' }
  | { type: 'offer'; description: SessionDescription & { type: 'offer' } }
  | { type: 'answer'; description: SessionDescription & { type: 'answer' } }
  | { type: 'ice'; candidate: IceCandidate };

interface LegacyFields { candidate: ''; id: ''; label: '' }

export type OutgoingMessage =
  | (LegacyFields & { type: 'sdp'; data: SessionDescription & { type: 'offer' }; sdp: string })
  | (LegacyFields & { type: 'answer'; data: SessionDescription & { type: 'answer' }; sdp: string })
  | (LegacyFields & { type: 'ice'; data: RTCIceCandidateInit; sdp: '' })
  | (LegacyFields & { type: 'peer-left'; data: ''; sdp: '' });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function decodeMessage(
  value: unknown,
  offerer: boolean | undefined,
  awaitingAnswer: boolean
): IncomingMessage | Error {
  if (!isRecord(value)) return new Error('Invalid signaling message');

  switch (value.type) {
    case 'matched':
      return typeof value.match === 'string' && value.match.length > 0 &&
        typeof value.offer === 'boolean'
        ? { type: 'matched', match: value.match, offer: value.offer }
        : new Error('Invalid match message');
    case 'on-going-call':
    case 'peer-left':
      return { type: value.type };
    case 'sdp':
    case 'answer': {
      const nested = isRecord(value.data) ? value.data : undefined;
      if (nested?.sdp !== undefined && typeof nested.sdp !== 'string') {
        return new Error('Invalid SDP message');
      }
      const sdp = typeof nested?.sdp === 'string' ? nested.sdp : value.sdp;
      if (typeof sdp !== 'string' || sdp.length === 0 ||
        (typeof value.sdp === 'string' && value.sdp !== sdp)) {
        return new Error('Invalid SDP message');
      }
      const nestedType = nested?.type;
      if ((nestedType !== undefined && nestedType !== 'offer' && nestedType !== 'answer') ||
        (value.type === 'answer' && nestedType === 'offer')) {
        return new Error('Invalid SDP type');
      }
      // Android omits the SDP type, so the call role or a local offer identifies its answer.
      const type = nestedType ?? (value.type === 'answer'
        ? 'answer'
        : awaitingAnswer || offerer === true ? 'answer' : offerer === false ? 'offer' : undefined);
      if (type !== 'offer' && type !== 'answer') {
        return new Error('Cannot identify SDP before matching');
      }
      if (type === 'offer') return { type: 'offer', description: { type: 'offer', sdp } };
      return { type: 'answer', description: { type: 'answer', sdp } };
    }
    case 'ice': {
      const nested = isRecord(value.data) ? value.data : value;
      const { candidate } = nested;
      const mid = nested === value ? nested.id : nested.sdpMid;
      const index = nested === value ? nested.label : nested.sdpMLineIndex;
      if (typeof candidate !== 'string' || candidate.length === 0 ||
        (mid != null && typeof mid !== 'string') ||
        (index != null && (typeof index !== 'number' || !Number.isInteger(index) || index < 0)) ||
        (mid == null && index == null)) {
        return new Error('Invalid ICE candidate');
      }
      return {
        type: 'ice',
        candidate: {
          candidate,
          sdpMid: typeof mid === 'string' ? mid : null,
          sdpMLineIndex: typeof index === 'number' ? index : null
        }
      };
    }
    default:
      return new Error(`Unsupported signaling message: ${String(value.type)}`);
  }
}
