from flask import Flask, render_template, request, jsonify, send_file
import yt_dlp
import os
from datetime import datetime
from database import init_db, add_download, get_downloads
import functools
from concurrent.futures import ThreadPoolExecutor

app = Flask(__name__)

# 初始化数据库
init_db()

# 设置代理
os.environ['HTTP_PROXY'] = 'http://127.0.0.1:7890'
os.environ['HTTPS_PROXY'] = 'http://127.0.0.1:7890'

# 创建下载目录
DOWNLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'downloads')
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

# 创建线程池
executor = ThreadPoolExecutor(max_workers=4)

# 创建视频信息缓存
video_info_cache = {}

# 缓存装饰器
def cache_video_info(func):
    @functools.wraps(func)
    def wrapper(url):
        if url in video_info_cache:
            return video_info_cache[url]
        result = func(url)
        video_info_cache[url] = result
        return result
    return wrapper

@cache_video_info
def extract_video_info(url):
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
        # 只获取必要的信息
        'skip_download': True,
        'format': 'best',
        # 限制字段
        'writesubtitles': False,
        'writeautomaticsub': False,
        'postprocessors': [],
        # 添加超时设置
        'socket_timeout': 10,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        try:
            info = ydl.extract_info(url, download=False)
            return {
                'title': info.get('title', '未知标题'),
                'thumbnail': info.get('thumbnail', ''),
                'description': info.get('description', '暂无描述')[:200] + '...',  # 限制描述长度
                'length': info.get('duration', 0),
                'views': info.get('view_count', 0),
                'publish_date': info.get('upload_date', '未知')
            }
        except Exception as e:
            print(f"Error extracting info: {str(e)}")
            raise

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/parse', methods=['POST'])
def parse_video():
    try:
        url = request.json.get('url')
        if not url:
            return jsonify({'success': False, 'error': '未提供URL'})

        # 使用线程池异步获取视频信息
        future = executor.submit(extract_video_info, url)
        video_info = future.result(timeout=15)  # 设置超时时间
        
        return jsonify({'success': True, 'data': video_info})
                
    except Exception as e:
        print(f"Error: {str(e)}")
        return jsonify({'success': False, 'error': f'视频解析失败: {str(e)}'})

# ... 其余代码保持不变 ...

@app.route('/download', methods=['POST'])
def download_video():
    try:
        url = request.json.get('url')
        format_option = request.json.get('format', 'best')
        
        if not url:
            return jsonify({'success': False, 'error': '未提供视频URL'})

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        output_template = os.path.join(DOWNLOAD_FOLDER, f'video_{timestamp}.%(ext)s')

        # 根据选择的格式设置下载选项
        format_options = {
            'best': 'bestvideo+bestaudio/best',
            'mp4': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
            'webm': 'bestvideo[ext=webm]+bestaudio[ext=webm]/best[ext=webm]',
            '720p': 'bestvideo[height<=720]+bestaudio/best[height<=720]',
            '1080p': 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
            'audio': 'bestaudio[ext=mp3]/bestaudio/best'
        }

        ydl_opts = {
            'format': format_options.get(format_option, 'best'),
            'outtmpl': output_template,
            'progress_hooks': [progress_hook],
        }

        # 如果是音频格式，添加转换设置
        if format_option == 'audio':
            ydl_opts.update({
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
                'extractaudio': True,
                'audioformat': 'mp3',
            })

        def progress_hook(d):
            if d['status'] == 'downloading':
                try:
                    downloaded = d.get('downloaded_bytes', 0)
                    total = d.get('total_bytes', 0) or d.get('total_bytes_estimate', 0)
                    if total > 0:
                        percent = (downloaded / total) * 100
                        print(f'Download Progress: {percent:.1f}%')
                except Exception as e:
                    print(f"Progress calculation error: {str(e)}")

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            video_file = ydl.prepare_filename(info)
            
            # 如果是音频格式，修改文件扩展名
            if format_option == 'audio':
                base, _ = os.path.splitext(video_file)
                video_file = base + '.mp3'
            
            filename = os.path.basename(video_file)
            
            # 添加到下载历史
            add_download(info.get('title', '未知标题'), url, filename)
            
            return jsonify({
                'success': True, 
                'filename': filename,
                'download_url': f'/download_file/{filename}'
            })

    except Exception as e:
        print(f"Download Error: {str(e)}")
        return jsonify({'success': False, 'error': f'下载失败: {str(e)}'})

@app.route('/download_file/<filename>')
def download_file(filename):
    try:
        return send_file(
            os.path.join(DOWNLOAD_FOLDER, filename),
            as_attachment=True,
            download_name=filename
        )
    except Exception as e:
        return jsonify({'success': False, 'error': f'文件下载失败: {str(e)}'})

@app.route('/history')
def get_download_history():
    try:
        downloads = get_downloads()
        history = [{
            'id': d[0],
            'title': d[1],
            'url': d[2],
            'filename': d[3],
            'date': d[4]
        } for d in downloads]
        return jsonify({'success': True, 'history': history})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)