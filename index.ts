import Log from '@machinomy/logger'
import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
const Web3IPC = require('web3-ipc')

const logger = new Log('extralight')

dotenv.config()

function pify<T> (fn: Function): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (err: any, res: T) => {
      if (err) {
        return reject(err)
      }

      return resolve(res)
    }

    fn(handler)
  })
}

const GETH_IPC = process.env.GETH_IPC || require('os').homedir() + '/Library/Ethereum/geth.ipc'
let AUTHORITY_URL = process.env.AUTHORITY_URL || 'http://localhost:5500'

if (AUTHORITY_URL.endsWith('/')) {
  AUTHORITY_URL = AUTHORITY_URL.slice(-1)
}

console.info('*** EXTRALIGHT IS RUNNING ***')

const web3 = new Web3IPC(GETH_IPC)
let account = ''
let nodeId = ''
let signature = ''

pify<string[]>((cb: (error: Error, accounts: string[]) => void) => web3.eth.getAccounts(cb)).then(async (accounts: string[]) => {
  account = accounts[0]
  logger.info('Account: ' + account)
  const nodeInfo = await pify((cb: (error: Error, result: any) => void) => web3.admin.nodeInfo(cb)) as object & { [key: string]: any }
  nodeId = nodeInfo['id']
  logger.info('NodeId: ' + nodeId)
  const hexOfNodeId = web3.fromAscii(nodeId)
  signature = await pify<string>((cb: (error: Error, signature: string) => void) => web3.eth.sign(account, hexOfNodeId, cb))
  logger.info('Signature: ' + signature)

  const body = { nodeId: nodeId, signature: signature }
  const response = await fetch(AUTHORITY_URL + '/el-nodes',
    {   method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    })
  if (response.ok) {
    const response2 = await fetch(AUTHORITY_URL + '/bc-nodes', { method: 'GET' })
    if (response2.ok) {
      const json = await response2.json()
      logger.info('json: ' + JSON.stringify(json))
      const bcEnode = json[0]['enode']
      if (bcEnode) {
        await pify((cb: (error: Error, result: any) => void) => web3.admin.addPeer(bcEnode, cb)).catch((error: Error) => logger.error(error))
        logger.info(`BCNode ${bcEnode} has been added to geth`)
      } else {
        logger.error(`Can not get BCNode for admin.addPeer`)
      }
    } else {
      logger.error(`Can not get BC-nodes after authorization with nodeId=${nodeId}, signature=${signature} and account=${account}`)
    }
  } else {
    logger.error(`Can not authorize with nodeId=${nodeId}, signature=${signature} and account=${account}`)
    logger.error(JSON.stringify(response.body))
  }
}).catch((error: Error) => {
  console.error(error)
  console.info('*** EXTRALIGHT WAS TERMINATED ***')
})
