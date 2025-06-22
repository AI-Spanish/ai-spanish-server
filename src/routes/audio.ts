import { Context } from 'hono';
import {
  failRes,
  generateUUID,
  MessageParamSchema,
  OSSParamsSchema,
  serverEnvs,
  successRes,
} from '@/utils';
import { calculateSign, textToSpeech } from '@/lib/tts';
import { insertMessage, updateMessage } from './message';
import { client, upload2Oss } from '@/lib/oss';
import { speechToText } from '@/lib/iat';
import axios from 'axios';
import fs from 'fs';

//POST
export async function text2audio(c: Context) {
  const body = await c.req.json();
  const { content, messageId } = MessageParamSchema.parse(body);
  if (!messageId) return c.json(failRes('no message id'));

  const res = await tts_youdao(c);
  const response = await res?.json();
  if (!response.success) return c.json(failRes({ message: '语音合成失败' }));

  try {
    const filename = generateUUID();
    const buffer = Buffer.from(response.data.buffer);
    const uploadResult: any = await upload2Oss(`${filename}.mp3`, buffer);

    //* Add Record
    await updateMessage(c, messageId, {
      filename: uploadResult.name,
      // seconds: audioData.ced,
    });

    console.log('🎙️ ~ update message ~ :', filename);
    return c.json(successRes({}));
  } catch (err) {}
}

//POST
export async function audio2text(c: Context) {
  const body = await c.req.parseBody();
  const historyId = body['historyId'];
  const seconds = body['seconds'];
  const file = body.file as any;

  const fileName = `${Date.now()}_${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(new Uint8Array(arrayBuffer));

  try {
    const uploadResult = (await upload2Oss(fileName, buffer)) as any;
    const content = await iat_youdao(buffer);

    //* Add Record
    // const messageId = await insertMessage(c, {
    //   historyId,
    //   filename: uploadResult.name,
    //   seconds,
    //   content: content,
    //   isAiRes: false,
    // });
    // console.log('🚀 ~ add message ~ :', messageId, content);

    return c.json(successRes({ ...uploadResult, content: content }));
  } catch (err) {
    return c.json(failRes({ err }));
  }
}

// GET
export async function getOssUrl(c: Context) {
  const { filename } = OSSParamsSchema.parse(c.req.query());

  const response = {
    'content-disposition': `attachment; filename=${encodeURIComponent(
      filename
    )}`,
  };
  // 填写待下载Object的完整路径，完整路径中不能包含Bucket名称。
  const url = client.signatureUrl(filename, {
    // 设置过期时间为3600s。
    expires: 3600,
    response,
  });

  return c.json(
    successRes({
      url,
    })
  );
}

// 废弃
// POST
export async function text2oss(c: Context) {
  const body = await c.req.json();
  const { content, messageId } = MessageParamSchema.parse(body);
  if (!messageId) return c.json(failRes('no message id'));

  console.log('🎙️ answer ==>', content);

  //* Text2Audio
  const callback = async (filename: string, buffer: any, audioData: any) => {
    try {
      const uploadResult: any = await upload2Oss(`${filename}.mp3`, buffer);

      //* Add Record
      await updateMessage(c, audioData.messageId, {
        filename: uploadResult.name,
        seconds: audioData.ced,
      });

      console.log(
        '🎙️ ~ update message ~ :',
        filename,
        buffer,
        audioData.messageId
      );
      return c.json(successRes({}));
    } catch (err) {}
  };

  console.log('🎙️ ~ start to speech ~ :', content);
  textToSpeech(
    {
      text: content,
      messageId: messageId,
    },
    callback
  );

  return c.text('');
}

// 废弃
// POST
export async function iat_xunfei(c: Context) {
  // 音频文件路径
  // const audioFile = './output/16k_10.pcm'; // 请替换为实际的音频文件路径
  const audioFile = './output/tmp.pcm'; // 请替换为实际的音频文件路径
  console.log('🚀 Audio file path ==>', audioFile);
  // 调用 iat 配置好的函数来处理音频识别
  speechToText(
    {
      //TODO:这里应该是要传入视频的路径，暂时先用空字符串代替
      inputFile: audioFile,
    },
    (sid: string, resultText: string) => {
      console.log(`识别会话ID: ${sid}`);
      console.log(`识别结果: ${resultText}`);
    }
  );

  return c.text('识别请求已发送');
}

// 废弃
// POST
export async function tts_xunfei(c: Context) {
  const content = 'hello';
  console.log('🚀 answer ==>', content);

  // xunfei
  textToSpeech(
    {
      text: content,
    },
    (filename: string, buffer: any) => {}
  );

  return c.text('');
}

// POST
export async function iat_youdao(buffer: Buffer) {
  // const outputFilePath = './output/youdao.mp3';
  // const buffer = fs.readFileSync(outputFilePath);
  const q = buffer.toString('base64');

  const appKey = serverEnvs.YOUDAO_APP_KEY;
  const appSecret = serverEnvs.YOUDAO_APP_SECRET;
  const salt = generateUUID();
  const curtime = Math.floor(Date.now() / 1000).toString();

  const response = await axios.post(
    'https://openapi.youdao.com/asrapi',
    {
      q: q,
      langType: 'es',
      appKey: appKey,
      salt: salt,
      sign: calculateSign(appKey, appSecret, q, salt, curtime),
      signType: 'v3',
      curtime: curtime,
      format: 'mp3',
      rate: '16000',
      channel: 1,
      type: 1,
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }
  );

  if (response.data.errorCode !== '0') {
    console.log(`🎙️ 语音识别 fail ${response.data.errorCode}`);
    return;
  }
  console.log('🎙️ 语音识别 success ==>', response.data.result);
  return response.data.result[0];
}

// POST
export async function tts_youdao(c: Context) {
  // const q =
  //   'Hola! ¿En qué puedo ayudarte hoy? ¿Quieresaprender espanol o necesitas ayuda con algo?';
  const body = await c.req.json();
  const { content, partner } = MessageParamSchema.parse(body);
  const q = content;
  const appKey = serverEnvs.YOUDAO_APP_KEY;
  const appSecret = serverEnvs.YOUDAO_APP_SECRET;
  const salt = generateUUID();
  const curtime = Math.floor(Date.now() / 1000).toString();

  const response = await axios.post(
    'https://openapi.youdao.com/ttsapi',
    {
      q: q,
      appKey: appKey,
      salt: salt,
      sign: calculateSign(appKey, appSecret, q, salt, curtime),
      signType: 'v3',
      curtime: curtime,
      voiceName: partner || 'xixiaomei',
      format: 'mp3',
    },
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'arraybuffer',
    }
  );

  if (!response.headers['content-type']?.includes('audio')) {
    return c.json(failRes({ message: '语音合成失败', data: response.data }));
  }

  const outputFilePath = './output/youdao.mp3';
  try {
    fs.writeFileSync(outputFilePath, response.data, 'binary');
    console.log(`🎙️ 语音合成 success ~`);
    return c.json(successRes({ buffer: response.data }));
  } catch (error) {
    console.log('🎙️ 语音合成失败', error);
  }
  return c.json(failRes({ message: '语音合成失败' }));
}

// GET
export async function testOSS(c: Context) {
  const { filename } = OSSParamsSchema.parse(c.req.query());

  const uploadResult = (await upload2Oss(
    `${filename}`,
    './output/tmp.mp3'
  )) as any;

  console.log('⛅️ ~ update message ~ :', uploadResult);
  return c.json(successRes({}));
}
