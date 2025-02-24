import path from "path";
import fs from 'fs';
import { CanAddr, CanBase, CanMessage, swapAddr } from "./share/can";
import { TesterInfo } from "./share/tester";
import UdsTester from "./workerClient";
import { CAN_TP, TpError as CanTpError } from "./docan/cantp";
import { UdsLOG } from "./log";
import { applyBuffer, getRxPdu, getTxPdu, ServiceItem } from "./share/uds";
import { findService } from "./docan/uds";
import { cloneDeep } from "lodash";
import type { Signal } from "src/renderer/src/database/dbc/dbcVisitor";
import { updateSignalPhys, updateSignalRaw } from "src/renderer/src/database/dbc/calc";
import { NodeItem } from "src/preload/data";
import LinBase from "./dolin/base";
import { EthAddr, EthBaseInfo, VinInfo } from "./share/doip";
import { LIN_TP,TpError as LinTpError } from "./dolin/lintp";
import { LinMode, LinMsg } from "./share/lin";
import { updateSignalVal } from "./dolin";
import { DOIP, DoipError } from "./doip";
export class NodeClass {
  private pool?: UdsTester
  private cantp: CAN_TP[] = []
  private lintp: LIN_TP[] = []
  private linBaseId: string[] = []
  private canBaseId: string[] = []
  private ethBaseId: string[] = []
  freeEvent: { doip: DOIP, id: string, cb: (data: { data: Buffer, ts: number } | DoipError) => void }[] = []
  log?: UdsLOG
  constructor(
    public nodeItem: NodeItem,
    private canBaseMap: Map<string, CanBase>,
    private linBaseMap: Map<string, LinBase>,
    private doips: DOIP[],
    private ethBaseMap: Map<string, EthBaseInfo>,
    private projectPath: string,
    private projectName: string,
    private testers: Record<string, TesterInfo>

  ) {

    for (const c of nodeItem.channel) {
      const baseItem = this.canBaseMap.get(c)
      if (baseItem) {
        this.canBaseId.push(c)
        baseItem.attachCanMessage(this.cb.bind(this))
        continue
      }
      const linBaseItem = this.linBaseMap.get(c)
      if (linBaseItem ) {
        linBaseItem.attachLinMessage(this.cb.bind(this))
        this.linBaseId.push(c)
        if(nodeItem.workNode){
          const db = linBaseItem.setupEntry(nodeItem.workNode)
          if (db) {
            linBaseItem.registerNode(db, nodeItem.workNode)
          }
        }
        continue
      }
      const ethBaseItem = this.ethBaseMap.get(c)
      if (ethBaseItem) {
        this.ethBaseId.push(c)
        
      }

    }
    if (nodeItem.script) {
      const outDir = path.join(this.projectPath, '.ScriptBuild')
      const scriptNameNoExt = path.basename(nodeItem.script, '.ts')
      const jsPath = path.join(outDir, scriptNameNoExt + '.js')
      if (fs.existsSync(jsPath)) {

        this.log = new UdsLOG(`${nodeItem.name} ${path.basename(nodeItem.script)}`)
        this.pool = new UdsTester({
          PROJECT_ROOT: this.projectPath,
          PROJECT_NAME: this.projectName,
          MODE: 'node',
          NAME: nodeItem.name,
        }, jsPath, this.log, this.testers)
        this.pool.registerHandler('output', this.sendFrame.bind(this))
        this.pool.registerHandler('sendDiag', this.sendDiag.bind(this))
        this.pool.registerHandler('setSignal', this.setSignal.bind(this))
        if(this.ethBaseId.length > 0){
            this.pool.registerHandler('registerEthVirtualEntity', this.registerEthVirtualEntity.bind(this))
        }


        //cantp
        for (const tester of Object.values(this.testers)) {
          if (tester && tester.address.length > 0) {
            for (const c of nodeItem.channel) {
              const canBaseItem = this.canBaseMap.get(c)
              if (canBaseItem && tester.type == 'can') {
                const tp = new CAN_TP(canBaseItem)
                for (const addr of tester.address) {
                  if (addr.type == 'can' && addr.canAddr) {
                    const idT = tp.getReadId(addr.canAddr)
                    tp.event.on(idT, (data) => {
                      if (data instanceof CanTpError) {
                        //TODO:
                      } else {

                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, true)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, true)
                              this.pool?.triggerSend(tester.name, item, data.ts).catch(e => {

                                this.log?.scriptMsg(e.toString(), data.ts, 'error');
                              })
                            } catch (e: any) {

                              this.log?.scriptMsg(e.toString(), data.ts, 'error');
                            }
                          }

                        }
                      }
                    })
                    const idR = tp.getReadId(swapAddr(addr.canAddr))
                    tp.event.on(idR, (data) => {
                      if (data instanceof CanTpError) {
                        //TODO:
                      } else {

                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, false)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, false)
                              this.pool?.triggerRecv(tester.name, item, data.ts).catch(e => {

                                this.log?.scriptMsg(e.toString(), data.ts, 'error');
                              })
                            } catch (e: any) {

                              this.log?.scriptMsg(e.toString(), data.ts, 'error');
                            }
                          }
                        }
                      }
                    })
                  }
                }
                this.cantp.push(tp)
              }
              const linBaseItem = this.linBaseMap.get(c)
              if (linBaseItem && tester.type == 'lin') {
                const tp = new LIN_TP(linBaseItem)
                for (const addr of tester.address) {
                  if (addr.type == 'lin' && addr.linAddr) {
                    const idT = tp.getReadId(LinMode.MASTER, addr.linAddr)
                    tp.event.on(idT, (data) => {
                      if (data instanceof LinTpError) {
                        //TODO:
                      } else {
                       
                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, true)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, true)
                              this.pool?.triggerSend(tester.name, item, data.ts).catch(e => {

                                this.log?.scriptMsg(e.toString(), data.ts, 'error');
                              })
                            } catch (e: any) {

                              this.log?.scriptMsg(e.toString(), data.ts, 'error');
                            }
                          }

                        }
                      }
                    })
                    const idR = tp.getReadId(LinMode.SLAVE, addr.linAddr)
                    tp.event.on(idR, (data) => {
                      if (data instanceof LinTpError) {
                        //TODO:
                      } else {

                        if (data.addr.uuid != this.nodeItem.id) {
                          const item = findService(tester, data.data, false)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, false)
                              this.pool?.triggerRecv(tester.name, item, data.ts).catch(e => {

                                this.log?.scriptMsg(e.toString(), data.ts, 'error');
                              })
                            } catch (e: any) {

                              this.log?.scriptMsg(e.toString(), data.ts, 'error');
                            }
                          }
                        }
                      }
                    })
                  }
                }
                this.lintp.push(tp)
              }
              const ethBaseItem = this.ethBaseMap.get(c)
              if (ethBaseItem && tester.type == 'eth') {
                const baseItem = this.doips.find(d => d.base.id == ethBaseItem.id)
                if (baseItem) {
                  for (const addr of tester.address) {
                    if (addr.type == 'eth' && addr.ethAddr) {
                      const idT = baseItem.getId(addr.ethAddr, 'client')
                     
                      const cbT = (data: { data: Buffer, ts: number } | DoipError) => {

                        if (data instanceof DoipError) {
                          //TODO:
                        } else {

                          const item = findService(tester, data.data, true)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, true)
                              this.pool?.triggerSend(tester.name, item, data.ts).catch(e => {

                                this.log?.scriptMsg(e.toString(), data.ts, 'error');
                              })
                            } catch (e: any) {

                              this.log?.scriptMsg(e.toString(), data.ts, 'error');
                            }
                          }


                        }
                      }
                      baseItem.event.on(idT, cbT)
                      this.freeEvent.push({ doip: baseItem, id: idT, cb: cbT })

                      const idR = baseItem.getId(addr.ethAddr, 'server')
                      const cbR = (data: { data: Buffer, ts: number } | DoipError) => {
                        if (data instanceof DoipError) {
                          //TODO:
                        } else {
                          const item = findService(tester, data.data, false)
                          if (item) {
                            try {
                              applyBuffer(item, data.data, false)
                              this.pool?.triggerRecv(tester.name, item, data.ts).catch(e => {

                                this.log?.scriptMsg(e.toString(), data.ts, 'error');
                              })
                            } catch (e: any) {

                              this.log?.scriptMsg(e.toString(), data.ts, 'error');
                            }
                          }

                        }
                      }
                      baseItem.event.on(idR, cbR)
                      this.freeEvent.push({ doip: baseItem, id: idR, cb: cbR })
                    }
                  }

                }
              }
            }
          }
        }
      }
    }

  }
  setSignal(pool: UdsTester, data: {
    signal: string,
    value: number | string | number[]
  }) {

    if (Array.isArray(data.value)) {
      throw new Error('can not set array value')
    }
    const s = data.signal.split('.')
    // 验证数据库是否存在
    const db = Object.values(global.database.can).find(db => db.name == s[0])
    if (db) {
      const signalName = s[1]

      let ss: Signal | undefined
      for (const msg of Object.values(db.messages)) {
        for (const signal of Object.values(msg.signals)) {
          if (signal.name == signalName) {
            ss = signal
            break
          }
        }
        if (ss) {
          break
        }
      }
      if (!ss) {
        throw new Error(`Signal ${signalName} not found`)
      }
      ss.physValue = data.value
      if (typeof data.value === 'string' && (ss.values || ss.valueTable)) {
        const value: {
          label: string;
          value: number;
        }[] = ss.values ? ss.values : db.valueTables[ss.valueTable!].values
        if (value) {
          const v = value.find(v => v.label === data.value)
          if (v) {
            ss.physValue = v.value
          }
        }
      }
      updateSignalPhys(ss)
    } else {
      const linDb = Object.values(global.database.lin).find(db => db.name == s[0])
      if (linDb) {

        const signalName = s[1]

        const signal = linDb.signals[signalName]
        if (!signal) {
          throw new Error(`Signal ${signalName} not found`)
        }
        // 更新信号值
        updateSignalVal(linDb, signalName, data.value)
      }
    }



  }
  async registerEthVirtualEntity(pool: UdsTester, data: {
    ip?: string,
    entity: VinInfo
  }) {
    let target = this.nodeItem.channel[0]
    if (data.ip) {
      target = data.ip
    }
    const baseItem = this.doips.find(d => d.base.device.handle == target)
    if (baseItem) {
      await baseItem.registerEntity(data.entity, true, this.log)
    }
  }
  async sendFrame(pool: UdsTester, frame: CanMessage | LinMsg): Promise<number> {
    if ('msgType' in frame) {
      frame.msgType.uuid = this.nodeItem.id
      if (this.canBaseId.length == 1) {
        const baseItem = this.canBaseMap.get(this.canBaseId[0])
        if (baseItem) {
          return await baseItem.writeBase(frame.id, frame.msgType, frame.data)
        }
      }
      for (const c of this.canBaseId) {
        const baseItem = this.canBaseMap.get(c)
        if (baseItem && baseItem.info.name == frame.device) {
          return await baseItem.writeBase(frame.id, frame.msgType, frame.data)
        }
      }
      throw new Error(`device ${frame.device} not found`)
    } else {
      frame.uuid = this.nodeItem.id
      frame.data = Buffer.from(frame.data)
      if (this.linBaseId.length == 1) {
        const baseItem = this.linBaseMap.get(this.linBaseId[0])
        if (baseItem) {
          baseItem.setEntry(frame.frameId, frame.data.length, frame.direction, frame.checksumType, frame.data, frame.isEvent ? 2 : 1)
          return await baseItem.write(frame)
        }
      }
      for (const c of this.linBaseId) {
        const baseItem = this.linBaseMap.get(c)
        if (baseItem && baseItem.info.name == frame.device) {
          return await baseItem.write(frame)
        }
      }
      throw new Error(`device ${frame.device} not found`)

    }

  }
  async sendDiag(pool: UdsTester, data: {
    device?: string
    address?: string
    service: ServiceItem
    isReq: boolean
    testerName: string
  }): Promise<number> {
    let tester = Object.values(this.testers).find(t => t.name == data.testerName)
    if (!tester) {
      throw new Error(`tester ${data.testerName} not found`)
    }
    if (tester) {

      if (tester.address.length == 0) {
        throw new Error(`address not found in ${tester.name}`)
      }
      let buf


      if (data.isReq) {
        buf = getTxPdu(data.service)
      } else {
        buf = getRxPdu(data.service)
      }

      if (tester.type == 'can') {

        if (this.canBaseId.length == 0) {
          throw new Error(`channel not found`)
        } else if (this.canBaseId.length == 1 || data.device == undefined) {

          if ((tester.address.length == 1 || data.address == undefined) && (tester.address[0].canAddr)) {
            const raddr = data.isReq ? tester.address[0].canAddr : swapAddr(tester.address[0].canAddr)
            raddr.uuid = this.nodeItem.id
            const ts = await this.cantp[0].writeTp(raddr, buf)

            return ts
          } else {
            //find address
            const addr = tester.address.find((a) => a.canAddr?.name == data.address)
            if (addr && addr.canAddr) {
              const raddr = data.isReq ? addr.canAddr : swapAddr(addr.canAddr)
              raddr.uuid = this.nodeItem.id
              const ts = await this.cantp[0].writeTp(raddr, buf)

              return ts
            }
          }
        } else {
          //find device
          let index = -1
          for (let i = 0; i < this.nodeItem.channel.length; i++) {
            if (this.canBaseMap.get(this.nodeItem.channel[i])?.info.name == data.device) {
              index = i
              break
            }
          }
          if (index >= 0) {

            if ((tester.address.length == 1 || data.address == undefined) && tester.address[0].canAddr) {
              const raddr = data.isReq ? tester.address[0].canAddr : swapAddr(tester.address[0].canAddr)
              raddr.uuid = this.nodeItem.id

              const ts = await this.cantp[index].writeTp(raddr, buf)

              return ts
            } else {
              //find address
              const addr = tester.address.find((a) => a.canAddr?.name == data.address)
              if (addr && addr.canAddr) {
                const raddr = data.isReq ? addr.canAddr : swapAddr(addr.canAddr)
                raddr.uuid = this.nodeItem.id
                const ts = await this.cantp[index].writeTp(raddr, buf)
                // if (data.isReq) {
                //   await this.pool?.triggerSend(data.service, ts)
                // } else {
                //   await this.pool?.triggerRecv(data.service, ts)
                // }
                return ts
              }
            }
          }

        }
      } else if (tester.type == 'lin') {
        if (this.linBaseId.length == 0) {
          throw new Error(`channel not found`)
        } else if (this.linBaseId.length == 1 || data.device == undefined) {

          if ((tester.address.length == 1 || data.address == undefined) && (tester.address[0].linAddr)) {
            const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
            const raddr = tester.address[0].linAddr

            const ts = await this.lintp[0].writeTp(mode, raddr, buf, this.nodeItem.id)

            return ts
          } else {
            //find address
            const addr = tester.address.find((a) => a.linAddr?.name == data.address)
            if (addr && addr.linAddr) {
              const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
              const raddr = addr.linAddr

              const ts = await this.lintp[0].writeTp(mode, raddr, buf, this.nodeItem.id)

              return ts
            }
          }
        } else {
          //find device
          let index = -1
          for (let i = 0; i < this.nodeItem.channel.length; i++) {
            if (this.linBaseMap.get(this.nodeItem.channel[i])?.info.name == data.device) {
              index = i
              break
            }
          }
          if (index >= 0) {

            if ((tester.address.length == 1 || data.address == undefined) && tester.address[0].linAddr) {
              const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
              const raddr = tester.address[0].linAddr


              const ts = await this.lintp[index].writeTp(mode, raddr, buf, this.nodeItem.id)

              return ts
            } else {
              //find address
              const addr = tester.address.find((a) => a.linAddr?.name == data.address)
              if (addr && addr.linAddr) {
                const mode = data.isReq ? LinMode.MASTER : LinMode.SLAVE
                const raddr = addr.linAddr

                const ts = await this.lintp[index].writeTp(mode, raddr, buf, this.nodeItem.id)

                return ts
              }
            }
          }

        }
      } else if (tester.type == 'eth') {
        if (tester.address.length == 0) {
          throw new Error(`address not found in ${tester.name}`)
        }
        const send = async (inst: DOIP, aa: EthAddr) => {
          if (data.isReq) {
            const buf = getTxPdu(data.service)
            const clientTcp = await inst.createClient(aa)
            const v = await inst.writeTpReq(clientTcp, buf)
            return v.ts
          } else {
            const buf = getRxPdu(data.service)
            const v = await inst.writeTpResp(aa.tester, buf)
            return v.ts
          }
        }
        if (this.ethBaseId.length == 0) {
          throw new Error(`channel not found`)
        } else if (this.ethBaseId.length == 1 || data.device == undefined) {
          const doipInst = this.doips.find(d => d.base.id == this.ethBaseId[0])
          if (doipInst) {



            if ((tester.address.length == 1 || data.address == undefined) && (tester.address[0].ethAddr)) {
              const addr = tester.address[0].ethAddr
              return await send(doipInst, addr)

            } else {
              //find address
              const addr = tester.address.find((a) => a.ethAddr?.name == data.address)
              if (addr && addr.ethAddr) {

                return await send(doipInst, addr.ethAddr)
              }
            }
          } else {
            throw new Error(`Does't found attached tester`)
          }
        } else {
          //find device
          let index = -1
          for (let i = 0; i < this.ethBaseId.length; i++) {
            if (this.ethBaseMap.get(this.ethBaseId[i])?.name == data.device) {
              index = i
              break
            }
          }
          if (index >= 0) {
            const doipInst = this.doips.find(d => d.base.id == this.ethBaseId[index])
            if (doipInst) {
              if ((tester.address.length == 1 || data.address == undefined) && tester.address[0].ethAddr) {
                return await send(doipInst, tester.address[0].ethAddr)
              } else {
                //find address
                const addr = tester.address.find((a) => a.ethAddr?.name == data.address)
                if (addr && addr.ethAddr) {
                  return await send(doipInst, addr.ethAddr)

                }
              }
            } else {
              throw new Error(`Does't found attached tester`)
            }
          }

        }
      }


    } else {
      throw new Error(`Does't found attached tester`)
    }
    return 0;
  }
  close() {
   
    for (const c of this.nodeItem.channel) {
      const baseItem = this.canBaseMap.get(c)
      if (baseItem) {
        baseItem.detachCanMessage(this.cb.bind(this))
      }
      const linBaseItem = this.linBaseMap.get(c)
      if (linBaseItem) {
        linBaseItem.detachLinMessage(this.cb.bind(this))
      }
    }
    for (const e of this.freeEvent) {
      e.doip.event.removeListener(e.id, e.cb)
    }

    this.cantp.forEach(tp => {
      tp.close(false)
    })
    this.lintp.forEach(tp => {
      tp.close(false)
    })
    this.pool?.stop()

  }
  async start() {


    this.pool?.updateTs(0)
    await this.pool?.start(this.projectPath)

  }
  cb(frame: CanMessage | LinMsg) {

    if ('msgType' in frame) {
      if (frame.msgType.uuid != this.nodeItem.id) {
        this.pool?.triggerCanFrame(frame)
      }
    } else {
      if (frame.uuid != this.nodeItem.id) {
        this.pool?.triggerLinFrame(frame)
      }
    }

  }
}