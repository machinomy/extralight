import Log from '@machinomy/logger'
import HDWalletProvider from '@machinomy/hdwallet-provider'
import * as dotenv from 'dotenv'
import fetch from 'node-fetch'
import * as Web3 from 'web3'
// const geth = require('geth-private')
const spawn = require('child_process').spawn
const execFile = require('child_process').execFile

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

// const GETH_IPC = process.env.GETH_IPC || require('os').homedir() + '/Library/Ethereum/geth.ipc'
const MNEMONIC = process.env.MNEMONIC || ''
let AUTHORITY_URL = process.env.AUTHORITY_URL || 'http://localhost:5500'
let PROVIDER_URL = process.env.PROVIDER_URL || 'http://localhost:8545'
let GETH_DATADIR = process.env.GETH_DATADIR || require('os').homedir() + '/Library/Ethereum'

if (AUTHORITY_URL.endsWith('/')) {
  AUTHORITY_URL = AUTHORITY_URL.slice(-1)
}

if (PROVIDER_URL.endsWith('/')) {
  PROVIDER_URL = PROVIDER_URL.slice(-1)
}

if (GETH_DATADIR.endsWith('/')) {
  GETH_DATADIR = GETH_DATADIR.slice(-1)
}

console.info('*** EXTRALIGHT IS RUNNING ***')

let provider: Web3.Provider
spawn(`/usr/local/bin/geth`, ['--syncmode', 'light', '--datadir', GETH_DATADIR] )

console.info('*** GETH IS RUNNING ***')

setTimeout(() => {
  const providerForHDWallet = new Web3.providers.HttpProvider(PROVIDER_URL)
  provider = new HDWalletProvider(MNEMONIC, providerForHDWallet)
  const web3 = new Web3(provider)

  let account = ''
  let nodeId = ''
  let signature = ''

  pify<string[]>((cb: (error: Error, accounts: string[]) => void) => web3.eth.getAccounts(cb)).then(async (accounts: string[]) => {
    account = accounts[0]
    logger.info('Account: ' + account)
    const nodeInfo = await pify((cb: (error: Error, result: any) => void) => admin_nodeInfo(cb)) as object & { [key: string]: any }
    nodeId = nodeInfo['id']
    logger.info('NodeId: ' + nodeId)
    const hexOfNodeId = web3.fromAscii(String(nodeId))
    signature = await pify<string>((cb: (error: Error, signature: string) => void) => web3.eth.sign(account, hexOfNodeId, cb))
    logger.info('Signature: ' + signature)

    const body = { nodeId: hexOfNodeId, signature: signature }
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
        const bcEnode: string = json[0]['enode']
        if (bcEnode) {
          await pify((cb: (error: Error, result: any) => void) => admin_addPeer(bcEnode, cb)).catch((error: Error) => logger.error(error))
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
}, 5000)

function admin_nodeInfo (cb: Function) {
  const payload = {
    jsonrpc: '2.0',
    id: randomId(),
    method: 'admin_nodeInfo',
    params: []
  }
  provider.sendAsync(payload, (err, response) => cb(err, response))
}

function admin_addPeer (peer: string, cb: Function) {
  const payload = {
    jsonrpc: '2.0',
    id: randomId(),
    method: 'admin_addPeer',
    params: [peer]
  }
  provider.sendAsync(payload, (err, response) => cb(err, response))
}

function randomId (digits: number = 5) {
  const datePart = new Date().getTime() * Math.pow(10, digits)
  const extraPart = Math.floor(Math.random() * Math.pow(10, digits))
  return datePart + extraPart
}
