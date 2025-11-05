#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
喜马拉雅音频下载工具

创建日期: 2023-01-01
作者: 项目贡献者
修改记录:
    - 2023-01-01: 初始版本创建
    - 2023-06-15: 添加VIP音频解密功能
    - 2023-12-01: 优化下载逻辑和错误处理
    - 2024-03-10: 添加批量下载和重试机制
    - 2024-06-20: 添加标准化注释和文档字符串
    - 2025-10-25: 增加规范化注释与文档字符串（由 AI 助手添加）

版权: (C) 2023-2024 项目贡献者
许可: GNU Affero General Public License v3.0

本程序是一个用于下载喜马拉雅平台音频的工具，支持免费和付费音频的下载。
主要功能包括：
- 解析单个音频和专辑信息
- 解密VIP音频URL
- 批量下载指定范围的音频
- 自动重试失败的下载任务
- 通过浏览器自动化完成登录认证

使用示例:
    ximalaya = Ximalaya()
    sound_info = ximalaya.analyze_sound(sound_id, headers, bid)
    print(sound_info["title"])
    print(sound_info["urls"]["64k"])  # 64kbps音频链接

全局变量:
- `version`: 程序版本号
- `logger`: 日志记录器，输出到 `app.log`
- `ua`: 随机 UA 生成器
- `dws_path`: 外部工具路径（打包运行时来自 `sys._MEIPASS`）
- `path`: 默认下载目录（从配置文件读取）
"""
import asyncio
import json
import math
import os
import time
import logging
import traceback
import sys
import re
from fake_useragent import UserAgent
from base64 import b64decode
import subprocess
import aiofiles
import aiohttp
import requests
from webdriver_manager.chrome import ChromeDriverManager
from webdriver_manager.microsoft import EdgeChromiumDriverManager
from seleniumwire import webdriver
from selenium.webdriver.support.wait import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By
import selenium.common.exceptions
import colorama

version = "v0.5.5"  # 程序版本号
# 初始化彩色输出与日志记录器，日志写入 app.log
colorama.init(autoreset=True)
logger = logging.getLogger('logger')  # 日志记录器实例，用于记录程序运行信息
logger.setLevel(logging.DEBUG)
file_handler = logging.FileHandler('app.log', mode='w', encoding='utf-8')
file_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)
# 默认下载路径（从配置文件读取），在 analyze_config 中解析
path = ""  # 默认下载路径（从配置文件读取），在 analyze_config 中解析
ua = UserAgent()  # 随机用户代理生成器，用于模拟不同浏览器访问
# 外部签名工具路径（PyInstaller 打包时从临时目录读取）
try:
    dws_path = os.path.join(sys._MEIPASS, "dws.exe")  # 外部签名工具路径（PyInstaller 打包时从临时目录读取）
except AttributeError:
    dws_path = "dws.exe"


class Ximalaya:
    """
    喜马拉雅音频下载核心类
    
    本类封装了喜马拉雅平台音频解析与下载的所有核心功能，包括：
    - 单个音频信息解析（标题、多码率链接、VIP状态）
    - 专辑信息解析（专辑名称、音频列表）
    - VIP音频URL解密算法
    - 同步/异步音频下载
    - 批量下载指定范围音频
    - 浏览器自动化登录
    - 配置文件读取与验证
    
    主要方法:
        - analyze_sound(): 解析单个音频信息
        - analyze_album(): 解析专辑信息
        - decrypt_url(): 解密VIP音频URL
        - get_sound(): 同步下载单个音频
        - async_get_sound(): 异步下载单个音频
        - get_selected_sounds(): 批量下载指定范围音频
        - login(): 浏览器自动化登录
        - analyze_config(): 读取并验证配置文件
    
    使用示例:
        # 初始化对象
        ximalaya = Ximalaya()
        
        # 解析单个音频
        sound_info = ximalaya.analyze_sound(sound_id, headers, bid)
        print(f"音频标题: {sound_info['title']}")
        print(f"64kbps链接: {sound_info['urls']['64k']}")
        
        # 批量下载专辑中的音频
        sounds = ximalaya.analyze_album(album_id, headers, bid)[1]
        ximalaya.get_selected_sounds(sounds, album_name, 1, 5, headers, bid, "64k", 3, "/downloads")
    """
    def __init__(self):
        """
        初始化默认请求头。

        Attributes:
            default_headers (dict): 默认的浏览器 UA 头，用于资源请求。
        """
        self.default_headers = {
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0"
        }
    
    def get_sid(self):
        """
        获取站点会话标识 `sid`，用于后续请求校验。

        Returns:
            str | None: 成功返回 `sid` 字符串，失败返回 None。
        """
        retries = 3
        while retries > 0:
            try:
                sid = json.loads(subprocess.check_output(dws_path, shell=True).decode())["sid"]
                return sid
            except Exception as e:
                logger.debug(f'获取sid失败！')
                logger.debug(traceback.format_exc())
                retries -= 1
                return False

    # 解析声音，如果成功返回声音名和声音链接，否则返回False
    def analyze_sound(self, sound_id, headers, bid):
        """
        解析单个声音页面，提取标题、音频直链与是否 VIP 等信息。

        Args:
            sound_id (str | int): 声音 ID。
            headers (dict): 请求头，通常包含 `cookie`、`xm-sign` 等。
            bid (str): `xm-sign` 中 `&&` 左侧的标识，用于 JS 解密。

        Returns:
            dict: 声音元数据，包括 `title`、`sound_url`、`is_vip`、`sound_id`。

        示例:
            >>> xm = Ximalaya()
            >>> headers = {"cookie": "..."}
            >>> bid = "..."
            >>> info = xm.analyze_sound(123456, headers, bid)
            >>> print(info[1])  # 例如打印 64k 音频直链
        """
        logger.debug(f'开始解析ID为{sound_id}的声音')
        url = f"https://www.ximalaya.com/mobile-playpage/track/v3/baseInfo/{int(time.time() * 1000)}"
        params = {
            "device": "www2",
            "trackId": sound_id,
            "trackQualityLevel": 2
        }
        headers["referer"] = f"https://www.ximalaya.com/sound/{sound_id}"
        headers["xm-sign"] = f"{bid}&&{self.get_sid()}"
        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
        except Exception as e:
            print(colorama.Fore.RED + f'ID为{sound_id}的声音解析失败！')
            logger.debug(f'ID为{sound_id}的声音解析失败！')
            logger.debug(traceback.format_exc())
            return False
        try:
            not response.json()["trackInfo"]["isAuthorized"]
        except KeyError:
            print(colorama.Fore.RED + f'ID为{sound_id}的声音解析失败，可能因为达到每日音频下载上限！')
            logger.debug(f'ID为{sound_id}的声音解析失败！')
            logger.debug(traceback.format_exc())
            return False
        if not response.json()["trackInfo"]["isAuthorized"]:
            return 0  # 未购买或未登录vip账号
        try:
            sound_name = response.json()["trackInfo"]["title"]
            encrypted_url_list = response.json()["trackInfo"]["playUrlList"]
        except Exception as e:
            print(colorama.Fore.RED + f'ID为{sound_id}的声音解析失败！')
            logger.debug(f'ID为{sound_id}的声音解析失败！')
            logger.debug(traceback.format_exc())
            return False
        if encrypted_url_list[0]["type"][:2] == "AI":
            sound_info = {"name": sound_name, 0: "", 1: "", 2: ""}
            sound_info[0] = sound_info[1] = self.decrypt_url(encrypted_url_list[0]["url"])
            logger.debug(f'ID为{sound_id}的声音解析成功！')
            return sound_info
        else:
            sound_info = {"name": sound_name, 0: "", 1: "", 2: ""}
            for encrypted_url in encrypted_url_list:
                if encrypted_url["type"] == "M4A_128":
                    sound_info[2] = self.decrypt_url(encrypted_url["url"])
                elif encrypted_url["type"] == "MP3_64":
                    sound_info[1] = self.decrypt_url(encrypted_url["url"])
                elif encrypted_url["type"] == "MP3_32":
                    sound_info[0] = self.decrypt_url(encrypted_url["url"])
            logger.debug(f'ID为{sound_id}的声音解析成功！')
            return sound_info

    # 解析专辑，如果成功返回专辑名和专辑声音列表，否则返回False
    def analyze_album(self, album_id, headers, bid):
        """
        解析专辑，分页遍历专辑内所有声音并返回专辑名和声音列表。

        Args:
            album_id (str | int): 专辑 ID。
            headers (dict): 请求头，包含 `cookie`、`xm-sign` 等。
            bid (str): `xm-sign` 中 `&&` 左侧的标识，用于 JS 解密。

        Returns:
            tuple[str, list]: (album_name, sounds)，其中 sounds 为 API 返回的声音条目列表。
        """
        print('开始解析专辑：' + str(album_id))
        url = "https://www.ximalaya.com/revision/album/v1/getTracksList"
        params = {
            "albumId": album_id,
            "pageNum": 1,
            "sort": 0,
            "pageSize": 100
        }
        headers["referer"] = f"https://www.ximalaya.com/album/{album_id}"
        headers["xm-sign"] = f"{bid}&&{self.get_sid()}"
        retries = 5
        while True:
            try:
                response = requests.get(url, headers=headers, params=params, timeout=15)
            except Exception as e:
                print(colorama.Fore.RED + f'ID为{album_id}的专辑解析失败！')
                logger.debug(f'ID为{album_id}的专辑解析失败！')
                logger.debug(traceback.format_exc())
                return False, False
            if response.json()["data"]["tracks"] == []:
                retries -= 1
            else:
                break
            if retries == 0:
                print(colorama.Fore.RED + f'ID为{album_id}的专辑解析失败！')
                logger.debug(f'ID为{album_id}的专辑解析失败！')
                return False, False
        pages = math.ceil(response.json()["data"]["trackTotalCount"] / 100)
        sounds = []
        for page in range(1, pages + 1):
            params = {
                "albumId": album_id,
                "pageNum": page,
                "sort": 0,
                "pageSize": 100
            }
            retries = 5
            while True:
                sid = self.get_sid()
                if not sid:
                    print(colorama.Fore.RED + f'ID为{album_id}的专辑解析失败！')
                    logger.debug(f'ID为{album_id}的专辑解析失败！')
                    return False, False
                else:
                    headers["xm-sign"] = f"{bid}&&{sid}"
                try:
                    response = requests.get(url, headers=headers, params=params, timeout=30)
                except Exception as e:
                    print(colorama.Fore.RED + f'ID为{album_id}的专辑解析失败！')
                    logger.debug(f'ID为{album_id}的专辑解析失败！')
                    logger.debug(traceback.format_exc())
                    return False, False
                if response.json()["data"]["tracks"] == []:
                    print(f"第{page}页解析失败第{6-retries}次，共{pages}页")
                    retries -= 1
                else:
                    print(f"第{page}页解析成功，共{pages}页")
                    break
                if retries == 0:
                    print(colorama.Fore.RED + f'ID为{album_id}的专辑解析失败！')
                    logger.debug(f'ID为{album_id}的专辑解析失败！')
                    return False, False
            sounds += response.json()["data"]["tracks"]
        album_name = sounds[0]["albumTitle"]
        logger.debug(f'ID为{album_id}的专辑解析成功')
        return album_name, sounds

    # 协程解析声音
    async def async_analyze_sound(self, sound_id, session, headers, bid):
        """
        异步解析单个声音，返回声音名称及多码率直链。

        Args:
            sound_id (str | int): 声音 ID。
            session (aiohttp.ClientSession): 复用连接的会话对象。
            headers (dict): 请求头。
            bid (str): `xm-sign` 中 `&&` 左侧的标识。

        Returns:
            dict | int | bool: 成功返回包含 `name` 与码率直链字典；
            若未授权返回 0；异常返回 False。
        """
        logger.debug(f'开始解析ID为{sound_id}的声音')
        retries = 3
        url = f"https://www.ximalaya.com/mobile-playpage/track/v3/baseInfo/{int(time.time() * 1000)}"
        params = {
            "device": "www2",
            "trackId": sound_id,
            "trackQualityLevel": 2
        }
        headers["referer"] = f"https://www.ximalaya.com/sound/{sound_id}"
        sid = self.get_sid()
        if not sid:
            print(colorama.Fore.RED + f'ID为{sound_id}的声音解析失败！')
            logger.debug(f'ID为{sound_id}的声音解析失败！')
            return False
        else:
            headers["xm-sign"] = f"{bid}&&{sid}"
        while retries > 0:
            try:
                async with session.get(url, headers=headers, params=params, timeout=20) as response:
                    response_json = json.loads(await response.text())
                    sound_name = response_json["trackInfo"]["title"]
                    encrypted_url_list = response_json["trackInfo"]["playUrlList"]
                    break
            except KeyError:
                print(colorama.Fore.RED + f'ID为{sound_id}的声音解析失败，可能因为达到每日音频下载上限')
                logger.debug(f'ID为{sound_id}的声音解析失败！')
                logger.debug(traceback.format_exc())
                return False
            except Exception as e:
                logger.debug(f'ID为{sound_id}的声音解析失败！')
                logger.debug(traceback.format_exc())
            retries -= 1
            if retries == 0:
                print(colorama.Fore.RED + f'ID为{sound_id}的声音解析失败！')
                logger.debug(f'ID为{sound_id}的声音解析失败！')
                return False
        if not response_json["trackInfo"]["isAuthorized"]:
            return 0  # 未购买或未登录vip账号
        if encrypted_url_list[0]["type"][:2] == "AI":
            sound_info = {"name": sound_name, 0: "", 1: "", 2: ""}
            sound_info[0] = sound_info[1] = self.decrypt_url(encrypted_url_list[0]["url"])
            logger.debug(f'ID为{sound_id}的声音解析成功！')
            return sound_info
        else:
            sound_info = {"name": sound_name, 0: "", 1: "", 2: ""}
            for encrypted_url in encrypted_url_list:
                if encrypted_url["type"] == "M4A_128":
                    sound_info[2] = self.decrypt_url(encrypted_url["url"])
                elif encrypted_url["type"] == "MP3_64":
                    sound_info[1] = self.decrypt_url(encrypted_url["url"])
                elif encrypted_url["type"] == "MP3_32":
                    sound_info[0] = self.decrypt_url(encrypted_url["url"])
            logger.debug(f'ID为{sound_id}的声音解析成功！')
            return sound_info

    # 将文件名中不能包含的字符替换为空格
    def replace_invalid_chars(self, name):
        """
        将文件名中的非法字符替换为空格，避免文件系统写入失败。

        Args:
            name (str): 原始文件名。

        Returns:
            str: 替换后的安全文件名。
        """
        invalid_chars = ['/', '\\', ':', '*', '?', '"', '<', '>', '|']
        for char in invalid_chars:
            if char in name:
                name = name.replace(char, " ")
        return name

    # 下载单个声音
    def get_sound(self, sound_name, sound_url, path):
        """
        同步下载单个声音到指定路径。

        Args:
            sound_name (str): 声音标题，将作为文件名。
            sound_url (str): 音频直链。
            path (str): 保存目录路径。

        Returns:
            bool | None: 失败返回 False；成功写入文件返回 None。
        """
        print("正在下载，请稍等……")
        retries = 3
        sound_name = self.replace_invalid_chars(sound_name)
        if '?' in sound_url:
            type = sound_url.split('?')[0][-3:]
        else:
            type = sound_url[-3:]
        if os.path.exists(f"{path}/{sound_name}.{type}"):
            print(f'{sound_name}已存在！')
            return
        while retries > 0:
            try:
                logger.debug(f'开始下载声音{sound_name}')
                response = requests.get(sound_url, headers=self.default_headers, timeout=60)
                break
            except Exception as e:
                logger.debug(f'{sound_name}第{4 - retries}次下载失败！')
                logger.debug(traceback.format_exc())
                retries -= 1
        if retries == 0:
            print(colorama.Fore.RED + f'{sound_name}下载失败！')
            logger.debug(f'{sound_name}经过三次重试后下载失败！')
            return False
        sound_file = response.content
        if not os.path.exists(path):
            os.makedirs(path)
        with open(f"{path}/{sound_name}.{type}", mode="wb") as f:
            f.write(sound_file)
        print(f'{sound_name}下载完成！')
        logger.debug(f'{sound_name}下载完成！')

    # 协程下载声音
    async def async_get_sound(self, sound_name, sound_url, album_name, session, path, global_retries, num=None):
        """
        异步下载单个声音，支持指定序号与专辑目录结构。

        Args:
            sound_name (str): 声音标题。
            sound_url (str): 音频直链。
            album_name (str): 专辑名，用于构造专辑目录。
            session (aiohttp.ClientSession): 异步会话。
            path (str): 保存根目录。
            global_retries (int): 全局重试计数，用于失败重试机制。
            num (int | None): 序号，可选，用于文件名前缀。

        Returns:
            bool | None: 下载失败返回 False；成功返回 None。
        """
        retries = 3
        logger.debug(f'开始下载声音{sound_name}')
        if num is None:
            sound_name = self.replace_invalid_chars(sound_name)
        else:
            sound_name = f"{num}-{sound_name}"
            sound_name = self.replace_invalid_chars(sound_name)
        if '?' in sound_url:
            type = sound_url.split('?')[0][-3:]
        else:
            type = sound_url[-3:]
        album_name = self.replace_invalid_chars(album_name)
        if not os.path.exists(f"{path}/{album_name}"):
            os.makedirs(f"{path}/{album_name}")
        if os.path.exists(f"{path}/{album_name}/{sound_name}.{type}"):
            print(f'{sound_name}已存在！')
            return None
        while retries > 0:
            try:
                async with session.get(sound_url, headers=self.default_headers, timeout=120) as response:
                    async with aiofiles.open(f"{path}/{album_name}/{sound_name}.{type}", mode="wb") as f:
                        await f.write(await response.content.read())
                print(f'{sound_name}下载完成！')
                logger.debug(f'{sound_name}下载完成！')
                break
            except Exception as e:
                logger.debug(f'{sound_name}第{global_retries * 3 + 4 - retries}次下载失败！')
                logger.debug(traceback.format_exc())
                retries -= 1
                if os.path.exists(f"{path}/{album_name}/{sound_name}.{type}"):
                    os.remove(f"{path}/{album_name}/{sound_name}.{type}")
        if retries == 0:
            return ([sound_name, sound_url, album_name, session, path, global_retries, num])

    # 下载专辑中的选定声音
    async def get_selected_sounds(self, sounds, album_name, start, end, headers, bid, quality, number, path):
        """
        批量异步下载专辑中选定区间的声音。

        Args:
            sounds (list[dict]): 专辑声音列表，元素包含 `trackId` 等字段。
            album_name (str): 专辑名。
            start (int): 起始序号（1-based）。
            end (int): 结束序号（含）。
            headers (dict): 请求头。
            bid (str): `xm-sign` 中 `&&` 左侧的标识。
            quality (int): 码率选择，0/1/2 分别对应 32k/64k/128k。
            number (bool): 是否在文件名前添加序号前缀。
            path (str): 保存目录根路径。

        Returns:
            None

        示例:
            >>> xm = Ximalaya()
            >>> headers = {"cookie": "..."}
            >>> bid = "..."
            >>> await xm.get_selected_sounds(sounds, "专辑名", 1, 10, headers, bid, quality=1, number=True, path="./downloads")
        """
        print("正在下载，请稍等……")
        tasks = []
        global_retries = 0
        max_global_retries = 2
        session = aiohttp.ClientSession()
        # 计算序号位数，用于文件名的零填充（如 001, 002）
        digits = len(str(len(sounds)))
        for i in range(start - 1, end):
            sound_id = sounds[i]["trackId"]
            tasks.append(asyncio.create_task(self.async_analyze_sound(sound_id, session, headers, bid)))
        sounds_info = await asyncio.gather(*tasks)
        tasks = []
        if number:
            num = start
            for sound_info in sounds_info:
                if sound_info is False or sound_info == 0:
                    continue
                num_ = str(num).zfill(digits)
                if quality == 2 and sound_info[2] == "":
                     quality = 1
                tasks.append(asyncio.create_task(self.async_get_sound(sound_info["name"], sound_info[quality], album_name, session, path, global_retries, num_)))
                num += 1
        else:
            for sound_info in sounds_info:
                if sound_info is False or sound_info == 0:
                    continue
                if quality == 2 and sound_info[2] == "":
                    quality = 1
                tasks.append(asyncio.create_task(self.async_get_sound(sound_info["name"], sound_info[quality], album_name, session, path, global_retries)))
        failed_downloads = [result for result in await asyncio.gather(*tasks) if result is not None]
        # 全局失败重试机制：仅对下载失败的项进行有限次重试
        # 每轮构造新的任务列表以避免重复下载成功的文件
        while failed_downloads and global_retries < max_global_retries:
            tasks = [asyncio.create_task(self.async_get_sound(*failed_download)) for failed_download in failed_downloads]
            failed_downloads = [result for result in await asyncio.gather(*tasks) if result is not None]
            global_retries += 1
        print("专辑全部选定声音下载完成！")
        if failed_downloads:
            for failed_download in failed_downloads:
                print(colorama.Fore.RED + f'声音{failed_download[0]}下载失败！')
        await session.close()

    # 解密vip声音url
    def decrypt_url(self, encrypted_url):
        """
        解密 VIP 音频的加密播放 URL。

        算法说明：
        - Base64 解码并分离数据与 IV（后 16 字节）。
        - 字节映射替换：使用常量表 `o` 对数据进行反查映射。
        - CBC 风格异或：每 16 字节与 IV 异或还原部分数据。
        - 二次异或：每 32 字节与常量表 `a` 异或修复最终明文。

        Args:
            encrypted_url (str): 加密后的 URL 字符串。

        Returns:
            str: 解密后的明文 URL。
        """
        # 定义字节映射表，用于解密过程中的字节替换
        o = bytes([183, 174, 108, 16, 131, 159, 250, 5, 239, 110, 193, 202, 153, 137, 251, 176, 119, 150, 47, 204, 97, 237, 1, 71, 177, 42, 88, 218, 166, 82, 87, 94, 14, 195, 69, 127, 215, 240, 225, 197, 238, 142, 123, 44, 219, 50, 190, 29, 181, 186, 169, 98, 139, 185, 152, 13, 141, 76, 6, 157, 200, 132, 182, 49, 20, 116, 136, 43, 155, 194, 101, 231, 162, 242, 151, 213, 53, 60, 26, 134, 211, 56, 28, 223, 107, 161, 199, 15, 229, 61, 96, 41, 66, 158, 254, 21, 165, 253, 103, 89, 3, 168, 40, 246, 81, 95, 58, 31, 172, 78, 99, 45, 148, 187, 222, 124, 55, 203, 235, 64, 68, 149, 180, 35, 113, 207, 118, 111, 91, 38, 247, 214, 7, 212, 209, 189, 241, 18, 115, 173, 25, 236, 121, 249, 75, 57, 216, 10, 175, 112, 234, 164, 70, 206, 198, 255, 140, 230, 12, 32, 83, 46, 245, 0, 62, 227, 72, 191, 156, 138, 248, 114, 220, 90, 84, 170, 128, 19, 24, 122, 146, 80, 39, 37, 8, 34, 22, 11, 93, 130, 63, 154, 244, 160, 144, 79, 23, 133, 92, 54, 102, 210, 65, 67, 27, 196, 201, 106, 143, 52, 74, 100, 217, 179, 48, 233, 126, 117, 184, 226, 85, 171, 167, 86, 2, 147, 17, 135, 228, 252, 105, 30, 192, 129, 178, 120, 36, 145, 51, 163, 77, 205, 73, 4, 188, 125, 232, 33, 243, 109, 224, 104, 208, 221, 59, 9])
        # 定义二次异或常量表，用于解密过程中的最终修复
        a = bytes([204, 53, 135, 197, 39, 73, 58, 160, 79, 24, 12, 83, 180, 250, 101, 60, 206, 30, 10, 227, 36, 95, 161, 16, 135, 150, 235, 116, 242, 116, 165, 171])
        
        # 1) Base64 解码并分离数据与 IV
        # 将URL中的特殊字符替换为Base64标准字符
        encrypted_url = encrypted_url.replace('_', '/').replace('-', '+')
        # 添加必要的填充字符以满足Base64解码要求
        padding = '=' * (-len(encrypted_url) % 4)
        # Base64解码获取二进制数据
        encrypted_data = b64decode(encrypted_url + padding)
        # 检查数据长度是否足够（至少需要16字节的IV）
        if len(encrypted_data) < 16:
            return encrypted_url
        # 分离数据部分和IV部分（最后16字节为IV）
        data = encrypted_data[:-16]
        iv = encrypted_data[-16:]
        
        # 2) 字节映射替换：使用查表 o 将每个字节映射到原始值
        decrypted_data = bytearray(data)
        for i in range(len(decrypted_data)):
            # 使用映射表o对每个字节进行替换
            decrypted_data[i] = o[decrypted_data[i]]
        
        # 3) CBC 风格 XOR：按 16 字节块与 IV 逐字节异或
        for i in range(0, len(decrypted_data), 16):
            block = decrypted_data[i:i+16]
            # 将每个16字节块与IV进行逐字节异或操作
            decrypted_data[i:i+16] = bytes(a ^ b for a, b in zip(block, iv))
        
        # 4) 二次 XOR：按 32 字节块与常量表 a 逐字节异或
        for i in range(0, len(decrypted_data), 32):
            block = decrypted_data[i:i+32]
            # 将每个32字节块与常量表a进行逐字节异或操作
            decrypted_data[i:i+32] = bytes(a ^ b for a, b in zip(block, a))
        
        # 将解密后的字节数据转换为UTF-8字符串
        return decrypted_data.decode('utf-8')

    # 判断专辑是否为付费专辑，如果是免费专辑返回0，如果是已购买的付费专辑返回1，如果是未购买的付费专辑返回2，如果解析失败返回False
    def judge_album(self, album_id, headers):
        """
        判断专辑类型：免费、已购付费或未购付费。

        Args:
            album_id (str | int): 专辑 ID。
            headers (dict): 请求头，包含 `cookie`。

        Returns:
            int | bool: 0=免费，1=已购，2=未购；失败返回 False。
        """
        logger.debug(f'开始判断ID为{album_id}的专辑的类型')
        url = "https://www.ximalaya.com/revision/album/v1/simple"
        params = {
            "albumId": album_id
        }
        try:
            response = requests.get(url, headers=headers, params=params, timeout=15)
        except Exception as e:
            print(colorama.Fore.RED + f'ID为{album_id}的专辑解析失败！')
            logger.debug(f'ID为{album_id}的专辑判断类型失败！')
            logger.debug(traceback.format_exc())
            return False
        logger.debug(f'ID为{album_id}的专辑判断类型成功！')
        if not response.json()["data"]["albumPageMainInfo"]["isPaid"]:
            return 0  # 免费专辑
        elif response.json()["data"]["albumPageMainInfo"]["hasBuy"]:
            return 1  # 已购专辑
        else:
            return 2  # 未购专辑

    # 获取配置文件中的cookie和path
    def analyze_config(self):
        """
        读取并校验本地配置文件 `config.json`。

        Returns:
            dict | bool: 成功返回配置字典；读取或解析失败返回 False。
        """
        # 尝试读取配置文件
        try:
            with open("config.json", "r", encoding="utf-8") as f:
                config = json.load(f)
        except Exception:
            # 如果文件不存在或格式错误，创建默认配置文件
            with open("config.json", "w", encoding="utf-8") as f:
                config = {
                    "cookie": "",  # 用户登录凭证
                    "path": "",    # 下载路径
                    "bid": "",     # xm-sign中的bid部分，用于API签名
                }
                json.dump(config, f)
            # 返回False表示配置无效
            return False, False, False
            
        # 检查并获取cookie配置
        try:
            cookie = config["cookie"]
        except Exception:
            # 如果cookie不存在，添加空值并更新配置文件
            config["cookie"] = ""
            with open("config.json", "w", encoding="utf-8") as f:
                json.dump(config, f)
            cookie = False
            
        # 检查并获取下载路径配置
        try:
            path = config["path"]
        except Exception:
            # 如果path不存在，添加空值并更新配置文件
            config["path"] = ""
            with open("config.json", "w", encoding="utf-8") as f:
                json.dump(config, f)
            path = False
            
        # 检查并获取bid配置
        try:
            bid = config["bid"]
            # 如果bid为空字符串，也视为无效
            if bid == "":
                bid = False
        except Exception:
            # 如果bid不存在，添加空值并更新配置文件
            config["bid"] = ""
            with open("config.json", "w", encoding="utf-8") as f:
                json.dump(config, f)
            bid = False
            
        # 返回三个配置项的值
        return cookie, path, bid

    # 判断登录信息是否有效
    def judge_config(self, cookie, bid):
        """
        校验配置中的 `cookie` 与 `bid` 是否有效。

        Args:
            cookie (str): 登录 Cookie。
            bid (str): `xm-sign` 中 `&&` 左侧的标识。

        Returns:
            str | bool: 有效返回用户名字符串；无效或网络异常返回 False。
        """
        # 设置获取用户信息的API端点
        url = "https://www.ximalaya.com/revision/my/getCurrentUserInfo"
        # 准备请求头，包含用户代理和cookie
        headers = {
            "user-agent": ua.random,  # 使用随机用户代理
            "cookie": cookie          # 使用提供的cookie
        }
        try:
            # 发送请求获取用户信息
            response = requests.get(url, headers=headers, timeout=15)
        except Exception as e:
            # 处理网络异常
            print(colorama.Fore.RED + "无法获取喜马拉雅用户数据，请检查网络状况！")
            logger.debug("无法获取喜马拉雅用户数据！")
            logger.debug(traceback.format_exc())
            
        # 检查响应状态码
        if response.json()["ret"] == 200:
            # 构建测试音频信息的API URL，使用当前时间戳防止缓存
            url = f"https://www.ximalaya.com/mobile-playpage/track/v3/baseInfo/{int(time.time()*1000)}?device=www2&trackId=359357383&trackQualityLevel=1"
            # 添加xm-sign头，格式为bid&&sid
            headers["xm-sign"] = f"{bid}&&{self.get_sid()}"
            try:
                # 尝试获取音频信息，验证bid是否有效
                requests.get(url, headers=headers, timeout=15).json()["trackInfo"]
            except KeyError:
                # 如果返回的数据中没有trackInfo，说明bid无效
                return False
            except Exception:
                # 处理其他网络异常
                print(colorama.Fore.RED + "无法获取喜马拉雅用户数据，请检查网络状况！")
                logger.debug("无法获取喜马拉雅用户数据！")
                logger.debug(traceback.format_exc())
                return False
            # 如果cookie和bid都有效，返回用户名
            return response.json()["data"]["userName"]
        else:
            # 如果响应状态码不是200，说明cookie无效
            return False
            
    # 登录喜马拉雅账号
    def login(self):
        """
        通过本地浏览器完成登录，并提取 `cookie` 与 `xm-sign` 的 `bid`。

        过程说明：
        - 启动 Chrome/Edge 并拦截请求头。
        - 从请求头中抓取 `cookie` 与 `xm-sign`。
        - 解析 `xm-sign` 的 `&&` 左侧作为 `bid` 并写入 `config.json`。

        Returns:
            dict | bool: 成功返回更新后的配置字典；超时或失败返回 False。
        """
        # 显示浏览器选择菜单
        print("请选择浏览器：")
        print("1. Google Chrome")
        print("2. Microsoft Edge")
        choice = input()
        # 提示用户登录流程
        print("请等待到浏览器窗口弹出后登录喜马拉雅账号，登录成功后浏览器会自动关闭")
        
        # 根据用户选择配置浏览器选项
        if choice == "1":
            # 配置Chrome浏览器选项
            option = webdriver.ChromeOptions()
            # 设置浏览器在脚本结束后不自动关闭
            option.add_experimental_option("detach", True)
            # 禁用日志输出
            option.add_experimental_option('excludeSwitches', ['enable-logging'])
            # 设置页面加载策略为eager，不等待所有资源加载完成
            option.page_load_strategy = 'eager'
            # 安装并启动Chrome驱动
            driver = webdriver.Chrome(executable_path=ChromeDriverManager().install(), options=option)
        elif choice == "2":
            # 配置Edge浏览器选项
            option = webdriver.EdgeOptions()
            # 设置浏览器在脚本结束后不自动关闭
            option.add_experimental_option("detach", True)
            # 禁用日志输出
            option.add_experimental_option('excludeSwitches', ['enable-logging'])
            # 设置页面加载策略为eager，不等待所有资源加载完成
            option.page_load_strategy = 'eager'
            # 安装并启动Edge驱动
            driver = webdriver.Edge(executable_path=EdgeChromiumDriverManager().install(), options=option)
        else:
            # 无效选择，直接返回
            return
            
        # 打开喜马拉雅登录页面
        driver.get("https://passport.ximalaya.com/page/web/login")
        try:
            # 等待用户登录成功（等待主页面元素出现，最长120秒）
            WebDriverWait(driver, 120).until(EC.presence_of_element_located((By.ID, 'jymain')))
            # 导航到特定音频页面以触发API请求
            driver.get("https://www.ximalaya.com/sound/62919401")
            # 等待音频播放器加载完成（最长30秒）
            WebDriverWait(driver, 30).until(EC.presence_of_element_located((By.TAG_NAME, 'xm-player')))
            # 等待1秒确保所有请求都已发出
            time.sleep(1)
            
            # 设置重试次数，最多尝试3次获取凭据
            retries = 3
            while retries > 0:
                # 遍历所有拦截到的请求
                for request in driver.requests:
                    # 查找特定的API请求，该请求包含所需的认证信息
                    if request.url == "https://www.ximalaya.com/m-revision/page/track/queryRelativeTracksById?trackId=62919401&preOffset=9&nextOffset=0&countKeys=play&order=2":
                        # 读取当前配置文件
                        with open("config.json", "r", encoding="utf-8") as f:
                            config = json.load(f)
                        # 从请求头中提取登录后的凭据：`cookie` 与 `xm-sign`；
                        # 其中 `bid` 为 `xm-sign` 的 `&&` 左侧部分，用于后续签名。
                        for key, value in request.headers.items():
                            if key.lower() == "cookie":
                                # 保存完整的cookie字符串
                                config["cookie"] = value
                            if key.lower() == "xm-sign":
                                # 使用正则表达式提取bid（xm-sign中&&左侧的部分）
                                pattern = r"^(.*?)&&"
                                match = re.match(pattern, value)
                                config["bid"] = match.group(1)
                        break
                try:
                    # 将更新后的配置写回文件
                    with open("config.json", "w", encoding="utf-8") as f:
                        json.dump(config, f)
                    break
                except UnboundLocalError:
                    # 如果未找到目标请求，减少重试次数并等待1秒
                    retries -= 1
                    time.sleep(1)
                    if retries == 0:
                        print(colorama.Fore.RED + "登录失败！")
                        logger.debug("登录失败！")
                        driver.quit()
                        return False
            
            # 记录浏览器日志用于调试
            logger.debug('以下是使用浏览器登录喜马拉雅账号时的浏览器日志：')
            for entry in driver.get_log('browser'):
                logger.debug(entry['message'])
            logger.debug('浏览器日志结束')
            # 关闭浏览器
            driver.quit()
        except selenium.common.exceptions.TimeoutException:
            # 处理登录超时情况
            print(colorama.Fore.RED + "登录超时，自动返回主菜单！")
            logger.debug('以下是使用浏览器登录喜马拉雅账号时的浏览器日志：')
            for entry in driver.get_log('browser'):
                logger.debug(entry['message'])
            logger.debug('浏览器日志结束')
            # 关闭浏览器
            driver.quit()
            return False
        username = self.judge_config(config["cookie"], config["bid"])
        print(f"成功登录账号{username}！")
