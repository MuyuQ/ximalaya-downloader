#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
喜马拉雅下载器命令行界面

本文件提供了喜马拉雅下载器的命令行交互界面，支持用户通过命令行操作下载喜马拉雅平台上的音频内容。

创建日期: 2023-01-01
作者: Diaoxiaozhang
修改记录:
    - 2023-01-01: 初始版本创建
    - 2023-06-15: 添加专辑批量下载功能
    - 2023-09-20: 优化用户界面和错误处理
    - 2023-12-10: 添加音质选择和序号命名功能
版权信息: Copyright (c) 2023 Diaoxiaozhang
许可证: GNU Affero General Public License v3.0
项目地址: https://github.com/Diaoxiaozhang/Ximalaya-Downloader

功能描述:
    - 提供命令行交互界面
    - 支持单个声音下载
    - 支持专辑批量下载
    - 支持音质选择
    - 支持自定义下载路径
    - 自动检测更新
    - 用户登录管理

使用示例:
    python cli.py
    # 启动命令行界面，按照提示操作
"""

# 导入必要的库
import main
import asyncio
import re
import os
import time
import argparse
import requests
from fake_useragent import UserAgent
import tkinter as tk
from tkinter import filedialog
import json

# 全局变量和常量定义

# 当前程序版本号，从 main 模块获取
current_version = main.version

# Ximalaya 类实例，用于处理喜马拉雅平台相关的操作
ximalaya = main.Ximalaya()

# 异步事件循环，用于处理异步操作
loop = asyncio.get_event_loop()

# 命令行参数解析器，用于处理命令行输入参数
parser = argparse.ArgumentParser()
parser.add_argument('-s', '--sound', type=int, help='')

# 用户代理生成器，用于生成随机 User-Agent，模拟不同浏览器访问
ua = UserAgent()

def select_directory():
    """
    通过图形界面选择目录
    
    功能：
        使用 tkinter 的文件对话框让用户选择一个目录
    
    输入参数：
        无
    
    返回值：
        str: 用户选择的目录路径，如果用户取消选择则返回空字符串
    
    使用示例：
        directory = select_directory()
        if directory:
            print(f"选择的目录是: {directory}")
    """
    root = tk.Tk()
    root.withdraw()
    directory_path = filedialog.askdirectory()
    root.destroy()
    return directory_path

if __name__ == "__main__":
    """
    主程序入口
    
    功能：
        1. 检查程序版本并提示更新
        2. 加载配置文件，检查登录状态
        3. 提供交互式菜单，支持以下功能：
           - 下载单个声音
           - 下载专辑声音
           - 修改下载路径
           - 退出程序
    
    输入参数：
        无
    
    返回值：
        无
    
    使用示例：
        直接运行程序：python cli.py
        或使用命令行参数指定声音ID：python cli.py -s 123456
    """
    # 打印欢迎信息和项目地址
    print("欢迎使用喜马拉雅下载器")
    print("本程序发布于github，完全开源免费，仓库地址：https://github.com/Diaoxiaozhang/Ximalaya-Downloader")
    
    # 检查程序版本
    try:
        newest_version = requests.get("https://api.github.com/repos/Diaoxiaozhang/Ximalaya-Downloader/releases/latest").json()['tag_name']
        if newest_version == current_version:
            print(f"当前版本为{current_version}，已为最新版本！")
        else:
            print(f"检测到新版本{newest_version}，当前版本为{current_version}，强烈建议您前往github下载最新版本！")
    except Exception:
        print(f"自动检测新版本失败，当前版本为{current_version}，建议手动前往github检查是否有新版本！")
    
    # 加载配置文件
    cookie, path, bid = ximalaya.analyze_config()
    if not cookie or not bid:
        username = False
    else:
        username = ximalaya.judge_config(cookie, bid)
    
    # 检查下载路径
    if os.path.isdir(path):
        print(f"检测到已设置下载路径为{path}")
    else:
        print('在config文件中未检测到有效的下载路径，将使用默认下载路径./download')
        path = './download'
    
    # 检查登录状态
    if not username:
        print("未检测到有效喜马拉雅登录信息或登录信息已过期，请登录后再使用")
        ximalaya.login()
        headers = {
            "user-agent": ua.random,
            "cookie": ximalaya.analyze_config()[0]
        }
        bid = ximalaya.analyze_config()[2]
        logined = True
    else:
        print(f"已检测到有效登录信息，当前登录用户为{username}，如需切换账号请删除config.json文件然后重新启动本程序！")
        headers = {
            "user-agent": ua.random,
            "cookie": ximalaya.analyze_config()[0]
        }
        bid = ximalaya.analyze_config()[2]
        logined = True
    
    # 主循环，提供交互式菜单
    while True:
        print("请选择要使用的功能：")
        print("1. 下载单个声音")
        print("2. 下载专辑声音")
        print("3. 修改下载路径")
        print("4. 退出程序")
        choice = input()
        
        # 下载单个声音
        if choice == "1":
            print("请输入声音ID或链接：")
            _ = input()
            try:
                sound_id = int(_)
            except ValueError:
                try:
                    sound_id = re.search(r"sound/(?P<sound_id>\d+)", _).group('sound_id')
                except Exception:
                    print("输入有误，请重新输入！")
                    continue
            
            # 解析声音信息
            sound_info = ximalaya.analyze_sound(sound_id, headers, bid)
            if sound_info is False:
                continue
            if sound_info == 0 and logined:
                print(f"ID为{sound_id}的声音解析为vip声音或付费声音，但当前登录账号未购买！")
                continue
            elif sound_info == 0 and not logined:
                print(f"ID为{sound_id}的声音解析为vip声音或付费声音，请登录后再试！")
                continue
            
            # 选择音质并下载
            print(f"成功解析声音{sound_info['name']}，请选择您要下载的音质：（直接回车默认为普通音质）")
            print("0. 低音质")
            print("1. 普通音质")
            if sound_info[2] != "":
                print("2. 高音质")
            while True:
                choice = input()
                if choice == "":
                    choice = "1"
                if choice == "0" or choice == "1":
                    ximalaya.get_sound(sound_info["name"], sound_info[int(choice)], path)
                    break
                elif choice == "2" and sound_info[2] != "":
                    ximalaya.get_sound(sound_info["name"], sound_info[2], path)
                    break
                else:
                    print("输入有误，请重新输入！")
        
        # 下载专辑声音
        elif choice == "2":
            print("请输入专辑ID或链接：")
            input_album = input()
            try:
                album_id = int(input_album)
            except ValueError:
                try:
                    album_id = re.search(r"album/(?P<album_id>\d+)", input_album).group('album_id')
                except Exception:
                    print("输入有误，请重新输入！")
                    continue
            
            # 解析专辑信息
            album_name, sounds = ximalaya.analyze_album(album_id, headers, bid)
            if not sounds:
                continue
            album_type = ximalaya.judge_album(album_id, headers)
            if album_type == 0:
                print(f"成功解析免费专辑{album_id}，专辑名{album_name}，共{len(sounds)}个声音")
            elif album_type == 1:
                print(f"成功解析已购付费专辑{album_id}，专辑名{album_name}，共{len(sounds)}个声音")
            elif album_type == 2:
                if logined is True:
                    print(f"成功解析付费专辑{album_id}，专辑名{album_name}，但是当前登陆账号未购买此专辑或未开通vip")
                else:
                    print(f"成功解析付费专辑{album_id}，专辑名{album_name}，但是当前未登陆账号，请登录再尝试下载")
                continue
            else:
                continue
            
            # 专辑下载选项
            while True:
                print("请选择要使用的功能：")
                print("1. 下载整个专辑")
                print("2. 下载专辑的部分声音")
                print("3. 显示专辑内声音列表")
                choice = input()
                if choice == "1" or choice == "2":
                    # 确定下载范围
                    if choice == "1":
                        start = 1
                        end = len(sounds)
                    else:
                        while True:
                            print("请输入要下载的声音范围，中间用空格隔开，如输入“1 10”则表示下载第1到第10个声音：")
                            download_range = input()
                            try:
                                start, end = download_range.split(" ")
                                start = int(start)
                                end = int(end)
                            except Exception:
                                print("输入有误，请重新输入！")
                                continue
                            if start > end or start < 1 or end > len(sounds):
                                print("输入有误，请重新输入！")
                            else:
                                break
                    
                    # 下载免费或已购专辑
                    if album_type == 0 or album_type == 1:
                        while True:
                            print("请选择是否要在下载的音频文件名中加入序号：")
                            print("1. 加入序号")
                            print("2. 不加序号")
                            choice = input()
                            if choice == "1":
                                number = True
                                break
                            elif choice == "2":
                                number = False
                                break
                            else:
                                print("输入错误，请重新输入！")
                        
                        # 选择音质并下载
                        print("请选择您想要下载的音质：（直接回车默认为普通音质）")
                        print("0. 低音质")
                        print("1. 普通音质")
                        print("2. 高音质（如果没有高音质则将下载普通音质）")
                        choice = input()
                        while True:
                            if choice == "":
                                choice = "1"
                            if choice == "0" or choice == "1" or choice == "2":
                                loop.run_until_complete(ximalaya.get_selected_sounds(sounds, album_name, start, end, headers, bid, int(choice), number, path))
                                break
                            else:
                                print("输入有误，请重新输入！")
                    break
                elif choice == "3":
                    # 显示专辑内声音列表
                    for sound in sounds:
                        print(f"{sound['index']}. {sound['title']}")
                else:
                    print("无效的选择，请重新输入。")
        
        # 修改下载路径
        elif choice == "3":
            print("请在弹出的窗口中选择下载路径。")
            path_ = select_directory()
            if path_ == "":
                print("检测到目录选择窗口被关闭，将继续使用原有下载路径。")
            else:
                path = path_
                with open("config.json", "r") as f:
                    config = json.load(f)
                config["path"] = path
                with open("config.json", "w") as f:
                    json.dump(config, f)
                print(f"成功修改下载路径为{path}")
        
        # 退出程序
        elif choice == "4":
            break
        else:
            print("无效的选择，请重新输入。")
