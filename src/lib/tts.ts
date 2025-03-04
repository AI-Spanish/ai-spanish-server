/* Created by way on 2020/06/28.
 *
 * 在线语音合成 WebAPI 接口调用示例 接口文档（必看）：https://www.xfyun.cn/doc/tts/online_tts/API.html
 * 错误码链接：
 * https://www.xfyun.cn/document/error-code （code返回错误码时必看）
 *
 */
import CryptoJS from 'crypto-js';
import WebSocket from 'ws';
import fs from 'fs';
import { serverEnvs } from '@/utils';
import crypto from 'crypto';

type textToSpeechConfig = {
  text: string;
  appid?: string;
  apiSecret?: string;
  apiKey?: string;
  outFile?: string;

  hostUrl?: string;
  host?: string;
  uri?: string;
  outPath?: string;
  business?: Record<string, string>;
  messageId?: string;
};

/**
 * @description: 将文本转换为语音文件
 * @param {type}
 * @return:
 */
export function textToSpeech(config: textToSpeechConfig, callback?: Function) {
  const {
    text,
    appid = serverEnvs.APPID,
    apiKey = serverEnvs.TTS_API_KEY,
    apiSecret = serverEnvs.API_SECRET,
    outFile = './output/tmp.mp3',
    hostUrl = 'wss://tts-api.xfyun.cn/v2/tts',
    host = 'tts-api.xfyun.cn',
    uri = '/v2/tts',
    business = {
      // vcn: 'gabriela',
    },
    messageId,
  } = config;

  let resData: any;
  // 获取当前时间 RFC1123格式
  let date = new Date().toUTCString();
  // 设置当前临时状态为初始化
  let wssUrl =
    hostUrl +
    '?authorization=' +
    getAuthStr(date) +
    '&date=' +
    date +
    '&host=' +
    host;
  let ws = new WebSocket(wssUrl);

  // 连接建立完毕，读取数据进行识别
  ws.on('open', () => {
    console.log('🎙️ ~ 连接已建立!');
    send();
    // 如果之前保存过音频文件，删除之
    if (fs.existsSync(outFile)) {
      fs.unlink(outFile, (err: any) => {
        if (err) {
          console.log(err);
        }
      });
    }
  });

  // 得到结果后进行处理
  ws.on('message', (data: any, err: string) => {
    if (err) {
      console.log('message error: ' + err);
      return;
    }
    console.log('🎙️ ~ message ~ :', data);

    let res = JSON.parse(data);
    if (res.code != 0) {
      console.log(`${res.code}: ${res.message}`);
      ws.close();
      return;
    }
    // 将返回内容写入音频文件
    let audio = res.data.audio;
    let audioBuf = Buffer.from(audio, 'base64');
    save(res.sid, audioBuf);
    resData = res;

    // 完成
    if (res.code == 0 && res.data.status == 2) {
      ws.close();
      return;
    }
  });

  // 资源释放
  ws.on('close', () => {
    console.log('🎙️ ~ 连接已关闭!');
    callback &&
      callback(resData?.sid, outFile, {
        ...resData?.data,
        messageId,
      });
  });

  // 连接错误
  ws.on('error', (err: string) => {
    console.log('websocket connect err: ' + err);
  });

  // 鉴权签名
  function getAuthStr(date: string) {
    let signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${uri} HTTP/1.1`;
    let signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    let signature = CryptoJS.enc.Base64.stringify(signatureSha);
    let authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    let authStr = CryptoJS.enc.Base64.stringify(
      CryptoJS.enc.Utf8.parse(authorizationOrigin)
    );
    return authStr;
  }

  // 传输数据
  function send() {
    let frame = {
      // 填充common
      common: {
        app_id: appid,
      },
      // 填充business
      business: {
        aue: 'lame',
        sfl: 1,
        auf: 'audio/L16;rate=16000',
        vcn: 'xiaoyan',
        tte: 'UTF8',
        speed: 50,
        bgs: 0,
        ...business,
      },
      // 填充data
      data: {
        text: Buffer.from(text).toString('base64'),
        status: 2,
      },
    };
    ws.send(JSON.stringify(frame));
  }

  // 将文件保存在output目录
  function save(name: string, data: any) {
    // const outFile = `${outPath}/${name}.mp3`;
    // const outFile = `${outPath}/tmp.mp3`;
    console.log('🎙️ ~ text2speech outFile ', outFile);

    fs.writeFile(outFile, data, { flag: 'a' }, (err: any) => {
      if (err) {
        console.log('save error: ' + err);
        return;
      }
    });
  }
}

//* tts youdao

export function getInput(q: string) {
  if (q.length <= 20) {
    return q;
  }
  return q.slice(0, 10) + q.length + q.slice(-10);
}

export function calculateSign(
  appKey: string,
  appSecret: string,
  q: string,
  salt: string,
  curtime: string
) {
  const strSrc = appKey + getInput(q) + salt + curtime + appSecret;
  return encrypt(strSrc);
}

export function encrypt(strSrc: string) {
  const hash = crypto.createHash('sha256');
  hash.update(strSrc);
  return hash.digest('hex'); // 返回十六进制表示的哈希值
}
