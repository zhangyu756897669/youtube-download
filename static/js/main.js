// 添加全局变量来存储下载队列
let downloadQueue = [];
document.addEventListener('DOMContentLoaded', function() {
    const parseBtn = document.getElementById('parseBtn');
    const videoUrlInput = document.getElementById('videoUrl');
    const videoInfo = document.getElementById('videoInfo');

    // 加载历史记录
    loadHistory();

    // 添加回车键监听
    videoUrlInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // 阻止默认的回车键行为
            parseVideo(); // 调用解析视频函数
        }
    });

    // 点击解析按钮
    parseBtn.addEventListener('click', parseVideo);

    // 解析视频函数
    async function parseVideo() {
        if (!videoUrlInput.value) {
            alert('请输入YouTube视频URL');
            return;
        }

        try {
            const response = await fetch('/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: videoUrlInput.value
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                const info = result.data;
                videoInfo.style.display = 'block';
                videoInfo.innerHTML = `
                    <div class="col-md-8 mx-auto">
                        <div class="card">
                            <img src="${info.thumbnail}" class="card-img-top" alt="视频缩略图">
                            <div class="card-body">
                                <h5 class="card-title">${info.title}</h5>
                                <p class="card-text">${info.description}</p>
                                <div class="mt-3">
                                    <p><strong>发布日期：</strong> ${info.publish_date}</p>
                                    <p><strong>观看次数：</strong> ${info.views}</p>
                                    <p><strong>视频长度：</strong> ${info.length}秒</p>
                                </div>
                                <div class="mt-3">
                                    <label for="formatSelect" class="form-label">选择下载格式：</label>
                                    <select class="form-select mb-3" id="formatSelect">
                                        <option value="best">最佳质量 (默认)</option>
                                        <option value="mp4">MP4</option>
                                        <option value="webm">WebM</option>
                                        <option value="720p">720P</option>
                                        <option value="1080p">1080P</option>
                                        <option value="audio">仅音频 (MP3)</option>
                                    </select>
                                </div>
                                <div class="mt-3">
                                    <div class="form-check mb-2">
                                        <input class="form-check-input" type="checkbox" id="addToQueue">
                                        <label class="form-check-label" for="addToQueue">
                                            添加到下载队列
                                        </label>
                                    </div>
                                    <div id="downloadQueue" class="list-group mb-3" style="display: none;">
                                        <!-- 下载队列将在这里显示 -->
                                    </div>
                                    <button class="btn btn-primary me-2" onclick="addToQueue()">添加到队列</button>
                                    <button class="btn btn-success" onclick="downloadVideo()">直接下载</button>
                                    <button class="btn btn-success ms-2" onclick="startBatchDownload()" id="startBatchBtn" style="display: none;">开始批量下载</button>
                                    <button class="btn btn-danger ms-2" onclick="clearQueue()" id="clearQueueBtn" style="display: none;">清空队列</button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                alert('解析视频失败：' + result.error);
            }
        } catch (error) {
            console.error('Error:', error);
            alert('发生错误：' + error.message);
        }
    }
});

// ... 其余代码保持不变 ...

// 单个视频下载函数
async function downloadVideo() {
    const videoUrl = document.getElementById('videoUrl').value;
    const formatSelect = document.getElementById('formatSelect');
    const progressDiv = document.getElementById('downloadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    if (!videoUrl) {
        alert('请先输入视频URL');
        return;
    }

    try {
        // 显示进度条
        progressDiv.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';
        progressText.textContent = '准备下载...';

        const response = await fetch('/download', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: videoUrl,
                format: formatSelect.value
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        if (result.success) {
            // 更新进度为100%
            progressBar.style.width = '100%';
            progressBar.textContent = '100%';
            progressText.textContent = '下载完成！';

            // 创建下载链接
            const link = document.createElement('a');
            link.href = result.download_url;
            link.download = result.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 刷新历史记录
            await loadHistory();

            // 3秒后隐藏进度条
            setTimeout(() => {
                progressDiv.style.display = 'none';
            }, 3000);
        } else {
            progressDiv.style.display = 'none';
            alert('下载失败：' + result.error);
        }
    } catch (error) {
        progressDiv.style.display = 'none';
        console.error('Error:', error);
        alert('发生错误：' + error.message);
    }
}

// 添加到队列的函数
async function addToQueue() {
    const videoUrl = document.getElementById('videoUrl').value;
    const formatSelect = document.getElementById('formatSelect');
    const queueDiv = document.getElementById('downloadQueue');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const startBatchBtn = document.getElementById('startBatchBtn');

    if (!videoUrl) {
        alert('请先输入视频URL');
        return;
    }

    // 检查URL是否已在队列中
    if (downloadQueue.some(item => item.url === videoUrl)) {
        alert('该视频已在下载队列中');
        return;
    }

    try {
        const response = await fetch('/parse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url: videoUrl })
        });

        const result = await response.json();
        
        if (result.success) {
            const info = result.data;
            downloadQueue.push({
                url: videoUrl,
                title: info.title,
                format: formatSelect.value
            });

            // 显示队列和按钮
            queueDiv.style.display = 'block';
            clearQueueBtn.style.display = 'inline-block';
            startBatchBtn.style.display = 'inline-block';

            // 更新队列显示
            updateQueueDisplay();
        }
    } catch (error) {
        alert('添加到队列失败：' + error.message);
    }
}

// 更新队列显示
function updateQueueDisplay() {
    const queueDiv = document.getElementById('downloadQueue');
    queueDiv.innerHTML = downloadQueue.map((item, index) => `
        <div class="list-group-item d-flex justify-content-between align-items-center">
            <div>
                <h6 class="mb-0">${item.title}</h6>
                <small>格式: ${item.format}</small>
            </div>
            <button class="btn btn-sm btn-danger" onclick="removeFromQueue(${index})">移除</button>
        </div>
    `).join('');
}

// 从队列中移除
function removeFromQueue(index) {
    downloadQueue.splice(index, 1);
    updateQueueDisplay();
    if (downloadQueue.length === 0) {
        document.getElementById('downloadQueue').style.display = 'none';
        document.getElementById('clearQueueBtn').style.display = 'none';
        document.getElementById('startBatchBtn').style.display = 'none';
    }
}

// 清空队列
function clearQueue() {
    downloadQueue = [];
    document.getElementById('downloadQueue').style.display = 'none';
    document.getElementById('clearQueueBtn').style.display = 'none';
    document.getElementById('startBatchBtn').style.display = 'none';
}

// 批量下载
async function startBatchDownload() {
    if (downloadQueue.length === 0) {
        alert('下载队列为空');
        return;
    }

    const progressDiv = document.getElementById('downloadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    progressDiv.style.display = 'block';
    
    for (let i = 0; i < downloadQueue.length; i++) {
        const item = downloadQueue[i];
        progressText.textContent = `正在下载 ${i + 1}/${downloadQueue.length}: ${item.title}`;
        progressBar.style.width = `${((i + 1) / downloadQueue.length) * 100}%`;
        progressBar.textContent = `${Math.round(((i + 1) / downloadQueue.length) * 100)}%`;

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    url: item.url,
                    format: item.format
                })
            });

            const result = await response.json();
            if (result.success) {
                const link = document.createElement('a');
                link.href = result.download_url;
                link.download = result.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                alert(`下载失败: ${item.title} - ${result.error}`);
            }
        } catch (error) {
            alert(`下载出错: ${item.title} - ${error.message}`);
        }
    }

    // 完成后清空队列
    clearQueue();
    await loadHistory();

    // 3秒后隐藏进度条
    setTimeout(() => {
        progressDiv.style.display = 'none';
    }, 3000);
}

// 加载历史记录
async function loadHistory() {
    try {
        const response = await fetch('/history');
        const result = await response.json();
        
        if (result.success) {
            const historyDiv = document.getElementById('downloadHistory');
            historyDiv.innerHTML = result.history.map(item => `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h5 class="mb-1">${item.title}</h5>
                        <small>${item.date}</small>
                    </div>
                    <p class="mb-1">文件名: ${item.filename}</p>
                    <small>URL: ${item.url}</small>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('加载历史记录失败:', error);
    }
}

// 将函数添加到全局作用域
window.downloadVideo = downloadVideo;
window.addToQueue = addToQueue;
window.removeFromQueue = removeFromQueue;
window.clearQueue = clearQueue;
window.startBatchDownload = startBatchDownload;