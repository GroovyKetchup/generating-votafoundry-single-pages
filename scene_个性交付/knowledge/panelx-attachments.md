# 业务附件（attachments）

## 上传

使用 `sdk.file.uploadFile` 上传业务附件。支持普通上传和分片上传。

```ts
const result = await sdk.file.uploadFile(file);
// result: UploadFileResponse
// { state: 'SUCCEED', msg: '上传成功', data: '附件编号' }
```

`result.data` 是**附件编号**（文件编码），不是完整附件对象。上传成功后文件**尚未入库**——它只是临时存放在文件服务上，要等业务表单提交把附件编号随业务数据一起写入后才正式关联到记录。

分片上传适用于大文件。先用 `getFileServerConfig` 取到文件服务令牌与 baseUrl，再用 `calculateFileMD5` 计算文件 MD5，随后逐片调用 `uploadChunk`，最后 `mergeChunks` 合并：

```ts
// 获取文件服务器配置（访问令牌 + baseUrl）
const fileServerConfig = await sdk.file.getFileServerConfig({
  fileName: file.name,
});

// 计算文件 MD5（用于秒传判断）
const fileMd5 = await sdk.file.calculateFileMD5(file);

// 分片上传（每片 5MB，index 为分片索引）
const chunkResult = await sdk.file.uploadChunk({
  chunk: file.slice(0, 5 * 1024 * 1024), // Blob 分片
  accessToken: fileServerConfig.accessToken,
  fileMd5: fileMd5,
  index: 0,
  fileName: file.name,
  baseUrl: fileServerConfig.baseUrl,
});

// 合并分片
const mergeResult = await sdk.file.mergeChunks({
  accessToken: fileServerConfig.accessToken,
  fileName: file.name,
  fileSize: file.size,
  fileMd5: fileMd5,
  baseUrl: fileServerConfig.baseUrl,
});
```

`getChunkUploadProgress({ accessToken, fileMd5, fileName, fileSize })` 可查询分片上传进度。

## 附件数据流

```text
上传成功：{ state: 'SUCCEED', msg: '上传成功', data: '附件编号' }
表单提交：[{ 附件名称, 附件编号 }]
返回展示：[{ 附件名称, 附件编号, path, downloadUrl, previewUrl }]
```

- 上传后拿到附件编号，业务表单提交时按 `[{ 附件名称, 附件编号 }]` 形态把附件随业务数据一起写入。
- 查询/详情接口返回的附件项含 `附件名称`、`附件编号`，以及 `previewUrl`（预览）、`downloadUrl`（下载）。
- `previewUrl` 用于预览，`downloadUrl` 用于下载；二者是相对路径，需用 `sdk.getSdkEndpoint(...)` 转成绝对地址后再交给 `<img>`/`<a>`/`window.open`。

## 未入库：刚上传、尚未随表单提交

此时只有上传返回的**附件编号**，查询/详情还不会给出 `previewUrl` / `downloadUrl`。

- 预览和下载由**前端自行维护**（本地 `File`、`URL.createObjectURL` 等），不要对未入库附件调用 `getFileDownloadUrl`、`getFilePreviewUrl` 或 `downloadByEvent`。
- 附件编号不是 URL，也不能当 `path` 去拼下载地址。
- 用户取消表单、离开页面或切换记录时，由页面决定是否丢弃未入库文件；SDK 不自动清理。
- 错误处理不得把完整响应体或凭据打入日志；上传失败只展示用户可读错误信息。

## 已入库：查询/详情返回的附件

已随表单提交入库的附件，用返回项上的 `previewUrl`、`downloadUrl`：

```ts
const preview = sdk.getSdkEndpoint(item.previewUrl);
const download = sdk.getSdkEndpoint(item.downloadUrl);
```

- `previewUrl` 用于预览，`downloadUrl` 用于下载；二者是相对路径，必须用 `sdk.getSdkEndpoint(...)` 转成绝对地址后再交给 `<img>` / `<a>` / `window.open`。
- 这是表单附件字段的**默认**预览/下载方式。不要用手写 `/wp-file/api/filedownload` 拼接，也不要把 `getFileDownloadUrl(path)` 当成已入库附件的默认下载。

## 事件/按钮驱动下载（不是表单附件字段的默认路径）

`downloadByEvent` / `downloadByButton` 只用于事件或按钮触发的下载，返回 `FileDownloadInfo`。不要把它当成查询/详情附件字段的默认预览/下载方式。

```ts
const info = await sdk.file.downloadByEvent({
  panelCode: 'PANEL_CODE',
  eventName: 'download',
  eventParam: { fileId: 'FILE_ID' },
});
```

下载链接有 `expiresAt`。过期或参数非法时 SDK 抛出明确错误，不触发下载。也可使用 `getDownloadUrlByEvent` / `getDownloadUrlByButton` 只取 URL。

## 附件字段运行时结构

附件字段在 `dataSchema` 中 `dataType` 为 `attach`。运行时数据中附件字段值为文件标识或文件描述对象，具体结构由后端面板配置决定。

## 附件字段提交与空数组

- **新建**：附件字段的**空数组**若只是 UI 初始化占位（未从服务端加载、用户也未上传），**禁止写入新建 payload**；未加载、未操作的字段不伪造空数组上报。
- **编辑**：仅当用户**明确清空**已加载附件时，保留 `[]` 表示清空；整存整取**不能删除**编辑已有附件值。

## 上传进度、失败恢复和文件限制

- 上传进度通过 `getChunkUploadProgress` 查询
- 失败后可重试单个分片，不需重新上传全部
- 文件大小限制由后端配置决定，SDK 不内置前端大小上限
- 清理：上传失败后由业务组件决定是否重试或提示用户
