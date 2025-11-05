/**
 * 喜马拉雅音频下载器 - 主入口文件
 * 
 * 本文件作为项目的入口点，负责初始化应用程序并实现按需加载机制。
 * 使用ES6模块规范，支持动态导入和模块懒加载。
 * 
 * @author Ximalaya Downloader Team
 * @version 2.0.0
 */

// 导入核心模块
import { readConfig, validateConfig } from './core/configManager.js';

/**
 * 应用程序初始化
 * 初始化应用程序，加载配置并检查登录状态
 * 
 * @returns {Promise<Object>} 初始化结果
 * 
 * @example
 * // 初始化应用程序
 * const initResult = await initializeApp();
 * if (initResult.success) {
 *   console.log('应用程序初始化成功');
 *   console.log(`登录状态: ${initResult.isLoggedIn ? '已登录' : '未登录'}`);
 * } else {
 *   console.error(`初始化失败: ${initResult.error}`);
 * }
 */
export async function initializeApp() {
  try {
    // 读取配置
    console.log('正在加载配置...');
    const config = await readConfig();
    
    // 验证配置
    console.log('正在验证配置...');
    const validatedConfig = await validateConfig(config);
    
    // 检查是否需要登录
    if (validatedConfig.needLogin) {
      console.log('提示: 需要登录才能使用完整功能，请通过CLI界面登录');
    }
    
    // 检查登录状态
    console.log('正在检查登录状态...');
    const loginStatus = await checkLoginStatus();
    
    return {
      success: true,
      config: validatedConfig,
      isLoggedIn: loginStatus.isLoggedIn,
      username: loginStatus.username,
      needLogin: validatedConfig.needLogin || false
    };
  } catch (error) {
    return {
      success: false,
      error: `初始化失败: ${error.message}`
    };
  }
}

/**
 * 启动CLI界面
 * 动态导入CLI模块并启动命令行界面
 * 
 * @returns {Promise<void>} 无返回值
 * 
 * @example
 * // 启动CLI界面
 * await startCLI();
 */
export async function startCLI() {
  try {
    // 动态导入CLI模块
    const { startApp } = await import('./interfaces/cli.js');
    
    // 启动CLI应用
    await startApp();
  } catch (error) {
    console.error(`启动CLI失败: ${error.message}`);
    process.exit(1);
  }
}

/**
 * 下载单个音频
 * 动态导入所需模块并下载单个音频
 * 
 * @param {string} soundId - 音频ID
 * @param {Object} [options={}] - 下载选项
 * @param {string} [options.quality='high'] - 音频质量
 * @param {string} [options.path] - 下载路径
 * @param {boolean} [options.addSequenceNumber=false] - 是否添加序号
 * @returns {Promise<Object>} 下载结果
 * 
 * @example
 * // 下载单个音频
 * const result = await downloadSound('12345678', {
 *   quality: 'high',
 *   path: './downloads',
 *   addSequenceNumber: false
 * });
 * 
 * if (result.success) {
 *   console.log(`下载成功: ${result.filePath}`);
 * } else {
 *   console.error(`下载失败: ${result.error}`);
 * }
 */
export async function downloadSound(soundId, options = {}) {
  try {
    // 动态导入所需模块
    const { analyzeSound } = await import('./core/audioParser.js');
    const { downloadSoundWithNaming } = await import('./core/downloader.js');
    
    // 分析音频信息
    const soundInfo = await analyzeSound(soundId);
    
    if (!soundInfo.success) {
      return {
        success: false,
        error: `获取音频信息失败: ${soundInfo.error}`
      };
    }
    
    // 下载音频
    const downloadResult = await downloadSoundWithNaming(
      soundInfo.data,
      options.quality || 'high',
      options.path,
      options.addSequenceNumber || false
    );
    
    return downloadResult;
  } catch (error) {
    return {
      success: false,
      error: `下载音频失败: ${error.message}`
    };
  }
}

/**
 * 下载专辑
 * 动态导入所需模块并下载整个专辑
 * 
 * @param {string} albumId - 专辑ID
 * @param {Object} [options={}] - 下载选项
 * @param {string} [options.quality='high'] - 音频质量
 * @param {string} [options.path] - 下载路径
 * @param {boolean} [options.addSequenceNumber=true] - 是否添加序号
 * @param {Array<number>} [options.range] - 下载范围，如[1, 10]表示下载第1到10个音频
 * @returns {Promise<Object>} 下载结果
 * 
 * @example
 * // 下载整个专辑
 * const result = await downloadAlbum('12345678', {
 *   quality: 'high',
 *   path: './downloads',
 *   addSequenceNumber: true
 * });
 * 
 * if (result.success) {
 *   console.log(`下载成功，共下载 ${result.successCount} 个音频`);
 * } else {
 *   console.error(`下载失败: ${result.error}`);
 * }
 * 
 * @example
 * // 下载专辑中的部分音频
 * const result = await downloadAlbum('12345678', {
 *   quality: 'high',
 *   path: './downloads',
 *   addSequenceNumber: true,
 *   range: [1, 5] // 只下载前5个音频
 * });
 */
export async function downloadAlbum(albumId, options = {}) {
  try {
    // 动态导入所需模块
    const { analyzeAlbum } = await import('./core/audioParser.js');
    const { downloadSounds } = await import('./core/downloader.js');
    
    // 分析专辑信息
    const albumInfo = await analyzeAlbum(albumId);
    
    if (!albumInfo.success) {
      return {
        success: false,
        error: `获取专辑信息失败: ${albumInfo.error}`
      };
    }
    
    // 获取音频列表
    let sounds = albumInfo.data.sounds;
    
    // 应用下载范围
    if (options.range && Array.isArray(options.range) && options.range.length === 2) {
      const [start, end] = options.range;
      sounds = sounds.slice(start - 1, end);
    }
    
    // 下载音频
    const downloadResult = await downloadSounds(
      sounds,
      options.quality || 'high',
      options.path,
      options.addSequenceNumber !== false // 默认为true
    );
    
    return downloadResult;
  } catch (error) {
    return {
      success: false,
      error: `下载专辑失败: ${error.message}`
    };
  }
}

/**
 * 获取音频信息
 * 动态导入所需模块并获取音频信息
 * 
 * @param {string} soundId - 音频ID
 * @returns {Promise<Object>} 音频信息
 * 
 * @example
 * // 获取音频信息
 * const result = await getSoundInfo('12345678');
 * 
 * if (result.success) {
 *   console.log(`音频标题: ${result.data.title}`);
 *   console.log(`音频时长: ${result.data.duration}`);
 *   console.log(`是否VIP: ${result.data.isVip}`);
 * } else {
 *   console.error(`获取音频信息失败: ${result.error}`);
 * }
 */
export async function getSoundInfo(soundId) {
  try {
    // 动态导入所需模块
    const { analyzeSound } = await import('./core/audioParser.js');
    
    // 获取音频信息
    const result = await analyzeSound(soundId);
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: `获取音频信息失败: ${error.message}`
    };
  }
}

/**
 * 获取专辑信息
 * 动态导入所需模块并获取专辑信息
 * 
 * @param {string} albumId - 专辑ID
 * @returns {Promise<Object>} 专辑信息
 * 
 * @example
 * // 获取专辑信息
 * const result = await getAlbumInfo('12345678');
 * 
 * if (result.success) {
 *   console.log(`专辑标题: ${result.data.title}`);
 *   console.log(`专辑描述: ${result.data.intro}`);
 *   console.log(`音频数量: ${result.data.sounds.length}`);
 * } else {
 *   console.error(`获取专辑信息失败: ${result.error}`);
 * }
 */
export async function getAlbumInfo(albumId) {
  try {
    // 动态导入所需模块
    const { analyzeAlbum } = await import('./core/audioParser.js');
    
    // 获取专辑信息
    const result = await analyzeAlbum(albumId);
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: `获取专辑信息失败: ${error.message}`
    };
  }
}

/**
 * 用户登录
 * 动态导入所需模块并执行用户登录
 * 
 * @param {string} browserType - 浏览器类型
 * @param {Object} [options={}] - 登录选项
 * @returns {Promise<Object>} 登录结果
 * 
 * @example
 * // 使用Chrome浏览器登录
 * const result = await login('chrome');
 * 
 * if (result.success) {
 *   console.log(`登录成功，用户名: ${result.username}`);
 * } else {
 *   console.error(`登录失败: ${result.error}`);
 * }
 */
export async function login(browserType, options = {}) {
  try {
    // 动态导入所需模块
    const { login: doLogin } = await import('./core/login.js');
    
    // 执行登录
    const result = await doLogin(browserType, options);
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: `登录失败: ${error.message}`
    };
  }
}

/**
 * 检查登录状态
 * 动态导入所需模块并检查登录状态
 * 
 * @returns {Promise<Object>} 登录状态
 * 
 * @example
 * // 检查登录状态
 * const status = await checkLoginStatus();
 * 
 * if (status.isLoggedIn) {
 *   console.log(`已登录，用户名: ${status.username}`);
 * } else {
 *   console.log('未登录');
 * }
 */
export async function checkLoginStatus() {
  try {
    // 动态导入所需模块
    const { checkLoginStatus: doCheckLoginStatus } = await import('./core/login.js');
    
    // 检查登录状态
    const result = await doCheckLoginStatus();
    
    return result;
  } catch (error) {
    return {
      isLoggedIn: false,
      error: `检查登录状态失败: ${error.message}`
    };
  }
}

/**
 * 更新配置
 * 动态导入所需模块并更新配置
 * 
 * @param {Object} config - 新配置
 * @returns {Promise<Object>} 更新结果
 * 
 * @example
 * // 更新下载路径
 * const result = await updateConfig({
 *   path: './new_downloads',
 *   quality: 'high'
 * });
 * 
 * if (result.success) {
 *   console.log('配置更新成功');
 * } else {
 *   console.error(`配置更新失败: ${result.error}`);
 * }
 */
export async function updateConfig(config) {
  try {
    // 动态导入所需模块
    const { updateConfig: doUpdateConfig } = await import('./core/configManager.js');
    
    // 更新配置
    const result = await doUpdateConfig(config);
    
    return result;
  } catch (error) {
    return {
      success: false,
      error: `更新配置失败: ${error.message}`
    };
  }
}

// 如果直接运行此文件，则启动CLI界面
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('index.js')) {
  initializeApp()
    .then((result) => {
      if (result.success) {
        console.log('应用程序初始化成功');
        startCLI();
      } else {
        console.error(`应用程序初始化失败: ${result.error}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(`应用程序启动失败: ${error.message}`);
      process.exit(1);
    });
}