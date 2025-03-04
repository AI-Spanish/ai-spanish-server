import CryptoJS from 'crypto-js';
import WebSocket from 'ws';
import fs from 'fs';
import { serverEnvs } from '@/utils';
import { buffer } from 'stream/consumers';

type speechToTextConfig = {
  appid?: string;
  apiSecret?: string;
  apiKey?: string;
  inputFile?: string;
  buffer?: any;

  hostUrl?: string;
  host?: string;
  uri?: string;
  outPath?: string;
  business?: Record<string, string>;
  messageId?: string;
  highWaterMark?: number;
};

/**
 * 语音识别
 * @param inputFile 语音识别配置
 */
export function speechToText(config: speechToTextConfig, callback?: Function) {
  const {
    appid = serverEnvs.APPID,
    apiKey = serverEnvs.TTS_API_KEY,
    apiSecret = serverEnvs.API_SECRET,
    inputFile,

    hostUrl = 'wss://iat-niche-api.xfyun.cn/v2/iat',
    host = 'iat-api.xfyun.cn',
    uri = '/v2/iat',
    business = {
      language: 'es_es',
      // language: 'zh_cn',
      domain: 'iat',
      accent: 'mandarin',
      dwa: 'wpgs', // 动态修正
    },
    messageId,
    highWaterMark = 1024 * 1024, //暂时不知道有什么用
  } = config;

  //帧定义
  const FRAME = {
    STATUS_FIRST_FRAME: 0,
    STATUS_CONTINUE_FRAME: 1,
    STATUS_LAST_FRAME: 2,
  };

  let resData: any;
  // 获取当前时间 RFC1123格式
  let date = new Date().toUTCString();
  // 设置当前临时状态为初始化
  let status = FRAME.STATUS_FIRST_FRAME; // 初始化状态为首帧
  let currentSid = ''; // 识别 SID
  const iatResult: any[] = []; // 存储识别结果

  // WebSocket 连接地址
  const wssUrl =
    hostUrl +
    '?authorization=' +
    getAuthStr(date) +
    '&date=' +
    date +
    '&host=' +
    host;

  // 创建 WebSocket 连接
  const ws = new WebSocket(wssUrl);

  // 建立 WebSocket 连接后，开始读取音频文件
  ws.on('open', () => {
    console.log('WebSocket 连接已建立');
    // send(config.buffer);

    // 确保 inputFile 存在且是一个有效的字符串
    if (typeof inputFile !== 'string') {
      throw new Error('inputFile 必须是一个有效的文件路径');
    }

    var readerStream = fs.createReadStream(inputFile, {
      highWaterMark: highWaterMark,
    });

    // 当读取到音频数据时，发送到 WebSocket
    readerStream.on('data', (chunk) => {
      send(chunk);
    });

    // 读取完音频文件后，发送最后一帧
    readerStream.on('end', () => {
      status = FRAME.STATUS_LAST_FRAME;
      send('');
    });
  });

  // 处理收到的识别结果
  ws.on('message', (data: any, err: string) => {
    if (err) {
      console.log('message error: ' + err);
      return;
    }

    let res = JSON.parse(data);
    res = JSON.parse(data);
    if (res.code != 0) {
      console.log(`error code ${res.code}, reason ${res.message}`);
      return;
    }

    let resultText = '';

    if (res.data.status === 2) {
      // resultText += '最终识别结果: ';
      currentSid = res.sid; // 记录当前会话的 sid
      ws.close(); // 关闭连接
    } else {
      // resultText += '中间识别结果: ';
    }

    iatResult[res.data.result.sn] = res.data.result;

    // 动态修正识别结果
    if (res.data.result.pgs === 'rpl') {
      res.data.result.rg.forEach((index: number) => {
        iatResult[index] = null;
      });
      // resultText += '【动态修正】';
    }

    // 拼接最终的识别文本
    iatResult.forEach((result) => {
      if (result !== null) {
        result.ws.forEach((wsBlock: any) => {
          wsBlock.cw.forEach((cwBlock: any) => {
            resultText += cwBlock.w;
          });
        });
      }
    });

    // console.log('resultText===', resultText);
    resData = resultText;
  });

  // 连接关闭时的处理
  ws.on('close', () => {
    console.log('WebSocket 连接已关闭');
    // console.log(`本次识别的 sid: ${currentSid}`);
    callback && callback(currentSid, resData);
  });

  // 连接出错时的处理
  ws.on('error', (err) => {
    console.log(`WebSocket 连接错误: ${err}`);
  });

  // 获取鉴权字符串
  function getAuthStr(date: string) {
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${uri} HTTP/1.1`;
    const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    const signature = CryptoJS.enc.Base64.stringify(signatureSha);
    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authStr = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(authorizationOrigin)
    );
    return authStr;
  }

  // 发送数据帧
  function send(data: Buffer | string) {
    const frameDataSection = {
      status,
      format: 'audio/L16;rate=16000',
      audio: typeof data === 'string' ? '' : data.toString('base64'),
      encoding: 'raw',
    };

    let frame: any;

    switch (status) {
      case FRAME.STATUS_FIRST_FRAME:
        frame = {
          common: {
            app_id: appid,
          },
          business: business,
          // 填充data
          data: frameDataSection,
        };
        status = FRAME.STATUS_CONTINUE_FRAME;
        break;
      case FRAME.STATUS_CONTINUE_FRAME:
      case FRAME.STATUS_LAST_FRAME:
        frame = {
          data: frameDataSection,
        };
        break;
    }

    ws.send(JSON.stringify(frame));
  }
}
