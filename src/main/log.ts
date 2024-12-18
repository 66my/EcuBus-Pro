/* eslint-disable no-var */
import { transport, createLogger, format, Logger, } from 'winston'
import type { Format } from 'logform'
import Transport from 'winston-transport'
import { CAN_ERROR_ID, CanAddr, CanMessage, CanMsgType, getTsUs } from './share/can'
import EventEmitter from 'events'
import { Sequence, ServiceItem } from './share/uds'
import { PayloadType } from './doip';
import { LinMsg } from './share/lin'



const isDev = process.env.NODE_ENV !== 'production'


type LogFunc = () => Transport

export function createLogs(logs: LogFunc[], formats: Format[]) {

  global.sysLog = createLogger({
    transports: logs.map((t) => t()),
    format: format.combine(
      format.json(),
      format.label({ label: 'System' }), 
      ...formats
    ),
  })
  global.scriptLog = createLogger({
    transports: logs.map((t) => t()),
    format: format.combine(
      format.json(),
      format.label({ label: 'Script' }
      ), ...formats
    ),
  })

  for (const l of logs) {
    addTransport(l)
  }
  for (const f of formats) {
    addFormat(f)
  }
}


class Base extends Transport {
  constructor(opts?: Transport.TransportStreamOptions) {
    super(opts)
    //
    // Consume any custom options here. e.g.:
    // - Connection information for databases
    // - Authentication information for APIs (e.g. loggly, papertrail,
    //   logentries, etc.).
    //
  }

  log(info: any, callback: () => void) {
    if (process.env.VITEST) {

      console.table(info.message)
    }
    // Perform the writing to the remote service
    callback()
  }
}
const instanceFormat = format((info, opts: any) => {
  info.instance = opts.instance
  return info
})

export class CanLOG {
  vendor: string
  log: Logger
  logTp: Logger
  constructor(vendor: string, instance: string, private event: EventEmitter) {
    this.vendor = vendor
    const et1 = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `Can-${vendor}` }),
        ...externalFormat
      ),

    })
    const et2 = externalTransport.map((t) => t())
    this.logTp = createLogger({
      transports: [new Base(), ...et2],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `CanTp-${vendor}` }),
        ...externalFormat
      ),
    })
  }
  close() {
    this.log.close()
    this.logTp.close()
    this.event.removeAllListeners()

  }
  canBase(data: CanMessage) {
    this.log.debug({
      method: 'canBase',
      data
    })
    this.event.emit('can-frame', data)
  }
  canTp(data: { dir: 'OUT' | 'IN'; data: Buffer; ts: number; addr: CanAddr }) {
    this.logTp.info(
      {
        method: 'canTp',
        data
      }
    )
  }
  error(ts: number, msg?: string) {
    this.log.error(
      {
        method: 'canError',
        data: {
          ts: ts,
          msg: msg
        }
      }
    )
  }
}

const externalTransport: (() => Transport)[] = []

export function addTransport(t: () => Transport) {
  externalTransport.push(t)
}

export function clearTransport() {
  externalTransport.splice(0, externalTransport.length)
}

const externalFormat: Format[] = []
export function addFormat(f: Format) {
  externalFormat.push(f)
}
export function clearFormat() {
  externalFormat.splice(0, externalFormat.length)
}


export class UdsLOG {
  log: Logger
  startTime = Date.now()
  constructor(name: string, private id?: string) {
    const et = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et],
      format: format.combine(
        format.json(),
        format.label({ label: name }),
        ...externalFormat
      ),
    })
  }
  sent(service: ServiceItem, ts: number, recvData?: Buffer, msg?: string) {
    this.log.info({
      method: 'udsSent',
      id: this.id,
      data: {
        service,
        ts,
        recvData,
        msg
      }
    })
  }
  recv(service: ServiceItem, ts: number, recvData?: Buffer, msg?: string) {
    this.log.info({
      method: 'udsRecv',
      id: this.id,
      data: {
        service,
        ts,
        recvData,
        msg
      }
    })
  }
  warning(service: ServiceItem, sequence: Sequence, seqIndex: number, index: number, ts: number, recvData?: Buffer, msg?: string) {
    this.log.warn({
      method: 'udsWarning',
      id: this.id,
      data: {
        service,
        sequence,
        index,
        seqIndex,
        ts,
        recvData,
        msg
      }
    })
  }
  scriptMsg(msg: string, ts: number, level: 'info' | 'warn' | 'error' = 'info') {
    this.log[level]({
      method: 'udsScript',
      data: {
        msg,
        ts,
      }
    })
  }
  systemMsg(msg: string, ts: number, level: 'info' | 'warn' | 'error' = 'info') {
    this.log[level]({
      method: 'udsSystem',
      data: {
        msg,
        ts,
      }
    })
  }
  error(msg: string, ts: number, recvData?: Buffer) {
    this.log.error({
      method: 'udsError',
      id: this.id,
      data: {
        msg,
        ts,
        recvData
      }
    })
  }
  udsIndex(index: number, serviceName:string,action: 'start' | 'finished' | 'progress', percent?: number) {
    const l=action=='start'?'debug':'info'
    this.log[l]({
      method: 'udsIndex',
      id: this.id,
      data: {
        serviceName,
        index,
        action,
        percent
      }
    })

  }
  close() {
    this.log.close()
  }

}


export class DoipLOG {
  vendor: string
  log: Logger
  logTp: Logger

  constructor(vendor: string, instance: string, private event: EventEmitter, private ts: number) {
    this.vendor = vendor
    const et1 = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `IP-${vendor}` }),
        ...externalFormat
      ),

    })
    const et2 = externalTransport.map((t) => t())
    this.logTp = createLogger({
      transports: [new Base(), ...et2],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `CanTp-${vendor}` })
      ),
    })
  }
  close() {
    this.log.close()
    this.logTp.close()
    this.event.removeAllListeners()

  }
  ipBase(type: 'tcp' | 'udp', dir: 'OUT' | 'IN', local: { address?: string, port?: number }, remote: { address?: string, port?: number }, data: Buffer) {
    const payloadType = data.readUint16BE(2)
    let name = ''
    switch (payloadType) {
      case PayloadType.DoIP_HeaderNegativeAcknowledge:
        name = 'Generic DoIP header negative acknowledge'
        break
      case PayloadType.DoIP_VehicleIdentificationRequest:
        name = 'Vehicle identification request message'
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithVIN:
        name = 'Vehicle identification request message with VIN'
        break
      case PayloadType.DoIP_VehicleIdentificationRequestWithEID:
        name = 'Vehicle identification request message with EID'
        break
      case PayloadType.DoIP_VehicleAnnouncementResponse:
        name = 'Vehicle announcement message/vehicle identification response message'
        break
      case PayloadType.DoIP_RouteActivationRequest:
        name = 'Routing activation request'
        break
      case PayloadType.DoIP_RouteActivationResponse:
        name = 'Routing activation response'
        break
      case PayloadType.DoIP_AliveRequest:
        name = 'Alive check request'
        break
      case PayloadType.DoIP_AliveResponse:
        name = 'Alive check response'
        break
      case PayloadType.DoIP_EntityStateRequest:
        name = 'DoIP entity status request'
        break
      case PayloadType.DoIP_EntityStateResponse:
        name = 'DoIP entity status response'
        break
      case PayloadType.DoIP_PowerModeInfoRequest:
        name = 'Diagnostic power mode information request'
        break
      case PayloadType.DoIP_PowerModeInfoResponse:
        name = 'Diagnostic power mode information response'
        break
      case PayloadType.DoIP_DiagnosticMessage:
        name = 'Diagnostic message'
        break
      case PayloadType.DoIP_DiagnosticMessagePositiveAcknowledge:
        name = 'Diagnostic message positive acknowledgement'
        break
      case PayloadType.DoIP_DiagnosticMessageNegativeAcknowledge:
        name = 'Diagnostic message negative acknowledgement'
        break



    }
    const ts = getTsUs() - this.ts
    const val = {
      dir,
      type,
      local: `${local.address}:${local.port}`,
      remote: `${remote.address}:${remote.port}`,
      data,
      ts: ts,
      name: name,
    }
    this.log.info({
      method: 'ipBase',
      data: val
    })
    // this.event.emit('ip-frame', val)
    return ts
  }
  // doipTp(data: { dir: 'OUT' | 'IN'; data: Buffer; ts: number; addr: CanAddr }) {
  //   this.logTp.info(
  //     {
  //       method: 'canTp',
  //       data
  //     }
  //   )
  // }
  error(ts: number, msg?: string) {
    this.log.error(
      {
        method: 'ipError',
        data: {
          ts: ts,
          msg: msg
        }
      }
    )
  }
}

export class LinLOG {
  vendor: string
  log: Logger
  
  constructor(vendor: string, instance: string, private event: EventEmitter) {
    this.vendor = vendor
    const et1 = externalTransport.map((t) => t())
    this.log = createLogger({
      transports: [new Base(), ...et1],
      format: format.combine(
        format.json(),
        instanceFormat({ instance: instance }),
        format.label({ label: `Lin-${vendor}` }),
        ...externalFormat
      ),

    })
    
  }
  close() {
    this.log.close()
   
    this.event.removeAllListeners()

  }
  linBase(data: LinMsg|'busSleep'|'busWakeUp') {
    this.log.debug({
      method: 'linBase',
      data
    })
    this.event.emit('lin-frame', data)
  }
  
  error(ts: number, msg?: string) {
    this.log.error(
      {
        method: 'linError',
        data: {
          ts: ts,
          msg: msg
        }
      }
    )
  }
}