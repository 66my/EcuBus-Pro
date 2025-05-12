import { EventEmitter } from 'stream'
import { CanVendor } from './can'
import type { Frame, LDF } from 'src/renderer/src/database/ldfParse'
import { cloneDeep, isEqual } from 'lodash'

// export type LinVendor = 'peak'
export interface LinDevice {
  label: string
  id: string
  handle: any
  serialNumber?: string
  busy?: boolean
  toomossVolt?: number
}

export interface LinBaseInfo {
  id: string
  device: LinDevice
  baudRate: number
  mode: LinMode
  vendor: CanVendor
  name: string
  database?: string
}

/**
 * @category LIN
 */
export enum LinDirection {
  SEND = 'SEND',
  RECV = 'RECV',
  RECV_AUTO_LEN = 'RECV_AUTO_LEN'
}

/**
 * @category LIN
 */
export enum LinMode {
  MASTER = 'MASTER',
  SLAVE = 'SLAVE'
}

/**
 * @category LIN
 */
export enum LinChecksumType {
  CLASSIC = 'CLASSIC',
  ENHANCED = 'ENHANCED'
}

export enum LIN_ERROR_ID {
  LIN_BUS_ERROR,
  LIN_READ_TIMEOUT,
  LIN_BUS_BUSY,
  LIN_BUS_CLOSED,
  LIN_INTERNAL_ERROR,
  LIN_PARAM_ERROR
}

const linErrorMap: Record<LIN_ERROR_ID, string> = {
  [LIN_ERROR_ID.LIN_BUS_ERROR]: 'bus error',
  [LIN_ERROR_ID.LIN_READ_TIMEOUT]: 'read timeout',
  [LIN_ERROR_ID.LIN_BUS_BUSY]: 'bus busy',
  [LIN_ERROR_ID.LIN_INTERNAL_ERROR]: 'dll lib internal error',
  [LIN_ERROR_ID.LIN_BUS_CLOSED]: 'bus closed',
  [LIN_ERROR_ID.LIN_PARAM_ERROR]: 'param error'
}

/**
 * @category LIN
 */
export interface LinMsg {
  frameId: number
  data: Buffer
  direction: LinDirection
  checksumType: LinChecksumType
  checksum?: number
  database?: string
  device?: string
  workNode?: string
  name?: string
  isEvent?: boolean
  uuid?: string
  ts?: number
  /**
   * The children signals of the CAN message.
   * internal use
   */
  children?: {
    name: string
    data: string
  }[]
}

export class LinError extends Error {
  errorId: LIN_ERROR_ID
  msgType?: LinMsg

  constructor(errorId: LIN_ERROR_ID, msg?: LinMsg, extMsg?: string) {
    super(linErrorMap[errorId] + (extMsg ? `,${extMsg}` : ''))
    this.errorId = errorId
    this.msgType = msg
  }
}
export enum LIN_ADDR_TYPE {
  PHYSICAL = 'PHYSICAL',
  FUNCTIONAL = 'FUNCTIONAL'
}
export enum LIN_SCH_TYPE {
  DIAG_ONLY = 'DIAG_ONLY',
  DIAG_INTERLEAVED = 'DIAG_INTERLEAVED'
}
export interface LinAddr {
  name: string
  addrType: LIN_ADDR_TYPE
  nad: number
  stMin: number
  nAs: number
  nCr: number
  schType: LIN_SCH_TYPE
}

const LinPidTable = [
  0x80, 0xc1, 0x42, 0x03, 0xc4, 0x85, 0x06, 0x47, 0x08, 0x49, 0xca, 0x8b, 0x4c, 0x0d, 0x8e, 0xcf,
  0x50, 0x11, 0x92, 0xd3, 0x14, 0x55, 0xd6, 0x97, 0xd8, 0x99, 0x1a, 0x5b, 0x9c, 0xdd, 0x5e, 0x1f,
  0x20, 0x61, 0xe2, 0xa3, 0x64, 0x25, 0xa6, 0xe7, 0xa8, 0xe9, 0x6a, 0x2b, 0xec, 0xad, 0x2e, 0x6f,
  0xf0, 0xb1, 0x32, 0x73, 0xb4, 0xf5, 0x76, 0x37, 0x78, 0x39, 0xba, 0xfb, 0x3c, 0x7d, 0xfe, 0xbf
]

export function getPID(frameId: number) {
  return LinPidTable[frameId]
}

export function getFrameData(db: LDF, frame: Frame): Buffer {
  const data = Buffer.alloc(frame.frameSize)
  for (const signal of frame.signals) {
    const signalDef = cloneDeep(db.signals[signal.name])
    if (!signalDef) continue

    if (signalDef.singleType === 'ByteArray') {
      // Handle byte array type signals
      const initValues = (
        signalDef.value != undefined ? signalDef.value : signalDef.initValue
      ) as number[]
      const bytesToCopy = Math.ceil(signalDef.signalSizeBits / 8)
      initValues.reverse()
      for (let i = 0; i < bytesToCopy && i < initValues.length; i++) {
        const startBit = signal.offset + i * 8
        const byteOffset = Math.floor(startBit / 8)
        const bitOffset = startBit % 8

        if (bitOffset === 0) {
          // Aligned byte
          data[byteOffset] = initValues[i]
        } else {
          // Unaligned byte
          data[byteOffset] |= (initValues[i] << bitOffset) & 0xff
          if (byteOffset + 1 < data.length) {
            data[byteOffset + 1] = (initValues[i] >> (8 - bitOffset)) & 0xff
          }
        }
      }
    } else {
      // Handle scalar type signals - process bit by bit
      const value = (signalDef.value != undefined ? signalDef.value : signalDef.initValue) as number
      let tempValue = value

      for (let i = 0; i < signalDef.signalSizeBits; i++) {
        const targetBit = signal.offset + i
        const byteOffset = Math.floor(targetBit / 8)
        const bitOffset = targetBit % 8

        if (byteOffset < data.length) {
          // Clear bit
          data[byteOffset] &= ~(1 << bitOffset)
          // Set bit if needed
          if ((tempValue & 1) === 1) {
            data[byteOffset] |= 1 << bitOffset
          }
          tempValue >>= 1
        }
      }
    }
  }
  return data
}
