import pandas as pd
import json
import re
import os

import requests

from utils.AuthV3Util import addAuthParams

from dotenv import load_dotenv
import time

load_dotenv()

"""
This script converts a CSV file to a JSON file.
The CSV file : word, pos, translation, definition
The JSON output will have the following structure:
[
    {
        "id": "1",
        "pos": "adj.",
        "word": "gordo",
        "definition": "definition",
        "translation": "胖的",
        "voiceUrl": "DELE_A1/1_adj._gordo_es-es.mp3",
    },
    ...
]

wordInBook:
{
    wb_id: "modernSpanish1",
    word_id: "1",
  },
"""


# 您的应用ID
APP_KEY = os.getenv("YOUDAO_APP_KEY")
# 您的应用密钥
APP_SECRET = os.getenv("YOUDAO_APP_SECRET")
# 合成音频保存路径
PATH = "./data/"
# 书名
WORD_BOOK = "NewMiddleSchool"
os.makedirs(os.path.dirname(f"{PATH}{WORD_BOOK}/"), exist_ok=True)


def createRequest(q, filePath, voiceName="xixiaomei", format="mp3"):
    params = {"q": q, "voiceName": voiceName, "format": format}

    addAuthParams(APP_KEY, APP_SECRET, params)

    header = {"Content-Type": "application/x-www-form-urlencoded"}
    res = requests.post("https://openapi.youdao.com/ttsapi", params, header)
    # saveFile(res, filePath)
    contentType = res.headers["Content-Type"]
    if "audio" in contentType:
        fo = open(filePath, "wb")
        fo.write(res.content)
        fo.close()
        print("save file path: " + filePath)
    else:
        print(str(res.content, "utf-8"))


def saveFile(data, data_file):
    with open(data_file, mode="w", encoding="utf-8") as json_file:
        json.dump(data, json_file, ensure_ascii=False, indent=4)


def main(start, all_word_df, audio=False):
    data = []
    dataInBook = []
    sameWords = []

    data_file = f"./data/{WORD_BOOK}/{WORD_BOOK}.json"
    dataInBook_file = f"./data/{WORD_BOOK}/{WORD_BOOK}_inBook.json"
    same_file = f"./data/{WORD_BOOK}/{WORD_BOOK}_same.json"

    for index, row in df[start:].iterrows():

        # 查找相似
        isExist = all_word_df[all_word_df["word"] == row["word"]]
        if not isExist.empty:
            id = isExist["id"].values[0]
            sameWords.append({"word_id": id, "word": row["word"]})
        else:
            clean_word = re.sub(r"[^\w\s]", "", row["translation"])
            # todo 命名规则需要符合url规范
            id = f"{index}_{clean_word}"
            voiceUrl = f"{WORD_BOOK}/{id}.mp3"

            if audio:
                createRequest(row["word"], PATH + voiceUrl)
                # 防止语音合成请求太频繁报411错误
                time.sleep(1)

            entry = {
                "id": id,
                "pos": row["pos"] if "pos" in row and pd.notna(row["pos"]) else None,
                "word": row["word"],
                "definition": row["definition"],
                "translation": row["translation"],
                "voiceUrl": voiceUrl,
            }
            data.append(entry)

        dataInBook.append({"wb_id": WORD_BOOK, "word_id": id})

    print(f"Total Data {len(data)} ")

    # Sava JSON
    saveFile(data, data_file)
    saveFile(dataInBook, dataInBook_file)
    saveFile(sameWords, same_file)


if __name__ == "__main__":
    # ! 更新单词数据表
    all_word_path = "./data/word.csv"
    all_word_df = pd.read_csv(all_word_path, encoding="utf-8")

    csv_file_path = "./data/中学新教材 必修I.csv"
    df = pd.read_csv(csv_file_path, encoding="utf-8")

    # main(0)
    main(0, all_word_df, audio=False)
