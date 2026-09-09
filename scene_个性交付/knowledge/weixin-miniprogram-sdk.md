# WxMiniApi 接口文档

自动基于代码生成的调用列表：

## `getUserProfile`

**功能描述**：通过微信小程序接口, 获取用户信息（昵称/头像等）

### 参数类型: `GetUserProfileOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `message` | `string` | ✅ 是 | 显示在确认授权对话框里的文字信息 |
| `buttonLabel` | `string` | ✅ 是 | 显示在确认对话框里的按钮标签 |
| `type` | `UserProfileQueryType` | ⬜ 否 | 获取信息的类型 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `UserProfileDto`

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `nickName` | `string` | ⬜ 否 |  |
| `gender` | `number` | ⬜ 否 |  |
| `language` | `string` | ⬜ 否 |  |
| `city` | `string` | ⬜ 否 |  |
| `province` | `string` | ⬜ 否 |  |
| `country` | `string` | ⬜ 否 |  |
| `avatarUrl` | `string` | ⬜ 否 |  |
| `is_demote` | `boolean` | ⬜ 否 |  |

---

## `getPhoneNum`

**功能描述**：通过微信小程序接口，获取用户手机号码

### 参数类型: `GetPhoneNumOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `message` | `string` | ✅ 是 | 显示在确认授权对话框里的文字信息 |
| `buttonLabel` | `string` | ✅ 是 | 确认按钮标签 |
| `rejectButtonLabel` | `string` | ⬜ 否 | 拒绝按钮标签 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `PhoneNumDto`

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `encryptedData` | `string` | ⬜ 否 |  |
| `code` | `string` | ⬜ 否 |  |
| `iv` | `string` | ⬜ 否 |  |
| `appId` | `string` | ⬜ 否 |  |

---

## `makePhoneCall`

**功能描述**：拨打电话

### 参数类型: `MakePhoneCallOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `phoneNum` | `string` | ✅ 是 | 电话号码 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `chooseMedia`

**功能描述**：调起相机并选取照片/视频

### 参数类型: `ChooseMediaOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `count` | `number` | ⬜ 否 | 最多选取数量，默认 2 |
| `mediaTypes` | `string[]` | ⬜ 否 | 媒体类型，如 ['image', 'video', 'mix']，默认 ['mix'] |
| `sourceTypes` | `string[]` | ⬜ 否 | 来源类型，如 ['album', 'camera']，默认 ['album', 'camera'] |
| `maxDuration` | `number` | ⬜ 否 | 最大时长（秒），默认 30 |
| `sizeTypes` | `string[]` | ⬜ 否 | 尺寸类型，如 ['original', 'compressed']，默认 ['compressed', 'original'] |
| `camera` | `string` | ⬜ 否 | 摄像头方向 'back' \| 'front'，默认 'back' |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `WxLocalFile[]`

*注：返回值是一个**数组**，下面展示的是其内部**数组元素**的具体属性*

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `tempFilePath` | `string` | ⬜ 否 | 本地临时文件路径 |
| `size` | `number` | ⬜ 否 | 文件大小 |
| `fileType` | `string` | ⬜ 否 | 文件类型 |
| `duration` | `number` | ⬜ 否 | 视频时长（秒），视频时有效 |
| `thumbTempFilePath` | `string` | ⬜ 否 | 视频缩略图 |
| `width` | `number` | ⬜ 否 | 宽度，媒体文件有效 |
| `height` | `number` | ⬜ 否 | 高度，媒体文件有效 |

---

## `scanCode`

**功能描述**：扫描二维码，返回二维码内容

### 参数类型: `BaseOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `ScanCodeDto`

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `result` | `string` | ⬜ 否 | 所扫码的内容 |
| `scanType` | `string` | ⬜ 否 | 所扫码的类型 |
| `charSet` | `string` | ⬜ 否 | 所扫码的字符集 |
| `path` | `string` | ⬜ 否 | 当所扫的码为当前小程序二维码时，会返回此字段，内容为二维码携带的 path |
| `rawData` | `string` | ⬜ 否 | 原始数据，base64编码 |

---

## `readLocalFile`

**功能描述**：读取本地文件内容

### 参数类型: `ReadLocalFileOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `filePath` | `string` | ✅ 是 | 文件路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `ReadLocalFileDto`

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `data` | `string | ArrayBuffer` | ⬜ 否 | 文件内容 |

---

## `downloadFile`

**功能描述**：下载文件，返回临时文件路径

### 参数类型: `DownloadFileOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `url` | `string` | ✅ 是 | 文件 URL |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `string`

---

## `uploadFile`

**功能描述**：上传文件到服务器

### 参数类型: `UploadFileOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `url` | `string` | ✅ 是 | 上传目标服务器地址 |
| `filePath` | `string` | ✅ 是 | 本地临时文件路径 |
| `fileName` | `string` | ✅ 是 | 上传的目标文件名 |
| `formData` | `Record<string, string>` | ⬜ 否 | 其它表单参数（如用户/授权等） |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `string`

---

## `openDocument`

**功能描述**：打开预览文档（支持 txt/pdf/excel/word/ppt 等格式）

### 参数类型: `OpenDocumentOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `filePath` | `string` | ✅ 是 | 临时文件路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `saveImageToPhotosAlbum`

**功能描述**：保存图片到相册

### 参数类型: `SaveToAlbumOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `filePath` | `string` | ✅ 是 | 文件路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `saveVideoToPhotosAlbum`

**功能描述**：保存视频到相册

### 参数类型: `SaveToAlbumOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `filePath` | `string` | ✅ 是 | 文件路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `shareFileMessage`

**功能描述**：分享文件消息（将临时文件分享给他人）

### 参数类型: `ShareFileMessageOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `filePath` | `string` | ✅ 是 | 要分享的临时文件路径 |
| `fileName` | `string` | ✅ 是 | 显示在聊天界面的文件名（注意扩展名要正确） |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `chooseMessageFile`

**功能描述**：从聊天记录中选择文件

### 参数类型: `ChooseMessageFileOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `count` | `number` | ✅ 是 | 最多可以选择的文件个数（0~100） |
| `type` | `string` | ⬜ 否 | 文件类型：'all' \| 'video' \| 'image' \| 'file'，默认 'all' |
| `extensions` | `string[]` | ⬜ 否 | 文件扩展名过滤（仅 type=file 时有效） |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `WxLocalFile[]`

*注：返回值是一个**数组**，下面展示的是其内部**数组元素**的具体属性*

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `tempFilePath` | `string` | ⬜ 否 | 本地临时文件路径 |
| `size` | `number` | ⬜ 否 | 文件大小 |
| `fileType` | `string` | ⬜ 否 | 文件类型 |
| `duration` | `number` | ⬜ 否 | 视频时长（秒），视频时有效 |
| `thumbTempFilePath` | `string` | ⬜ 否 | 视频缩略图 |
| `width` | `number` | ⬜ 否 | 宽度，媒体文件有效 |
| `height` | `number` | ⬜ 否 | 高度，媒体文件有效 |

---

## `navigateTo`

**功能描述**：跳转到小程序内部页面

### 参数类型: `NavigateToOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `path` | `string` | ✅ 是 | 页面路径（如 '/pages/index/index'） |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `redirectTo`

**功能描述**：关闭当前页面后跳转

### 参数类型: `RedirectToOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `path` | `string` | ✅ 是 | 页面路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `reLaunch`

**功能描述**：关闭所有页面，打开应用内某页面（清空页面栈）

### 参数类型: `ReLaunchOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `path` | `string` | ✅ 是 | 页面路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `navigateBack`

**功能描述**：关闭当前页面，返回上一页面或多级页面

### 参数类型: `NavigateBackOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `delta` | `number` | ⬜ 否 | 返回的页面数，默认 1 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `loginGetCode`

**功能描述**：调用微信登录，返回登录码 code

### 参数类型: `BaseOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `string`

---

## `getLocation`

**功能描述**：获取当前位置（经纬度）

### 参数类型: `GetLocationOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `openIt` | `boolean` | ⬜ 否 | 获取后是否打开地图，默认 false |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `GpsLocationDto`

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `latitude` | `number` | ⬜ 否 |  |
| `longitude` | `number` | ⬜ 否 |  |
| `altitude` | `number` | ⬜ 否 |  |
| `horizontalAccuracy` | `number` | ⬜ 否 |  |
| `verticalAccuracy` | `number` | ⬜ 否 |  |
| `speed` | `number` | ⬜ 否 |  |
| `address` | `string` | ⬜ 否 |  |

---

## `openLocation`

**功能描述**：打开地图并定位到指定位置

### 参数类型: `OpenLocationOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `location` | `GpsLocationDto` | ✅ 是 | 位置坐标 |
| `  . latitude` | `number` | ⬜ 否 |  |
| `  . longitude` | `number` | ⬜ 否 |  |
| `  . altitude` | `number` | ⬜ 否 |  |
| `  . horizontalAccuracy` | `number` | ⬜ 否 |  |
| `  . verticalAccuracy` | `number` | ⬜ 否 |  |
| `  . speed` | `number` | ⬜ 否 |  |
| `  . address` | `string` | ⬜ 否 |  |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `chooseLocation`

**功能描述**：打开地图让用户选择位置，返回所选位置坐标

### 参数类型: `ChooseLocationOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `initLocation` | `GpsLocationDto` | ⬜ 否 | 初始定位（可选） |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `GpsLocationDto`

| 字段名 | 类型 | 可为空 | 描述 |
| --- | --- | --- | --- |
| `latitude` | `number` | ⬜ 否 |  |
| `longitude` | `number` | ⬜ 否 |  |
| `altitude` | `number` | ⬜ 否 |  |
| `horizontalAccuracy` | `number` | ⬜ 否 |  |
| `verticalAccuracy` | `number` | ⬜ 否 |  |
| `speed` | `number` | ⬜ 否 |  |
| `address` | `string` | ⬜ 否 |  |

---

## `setSharePageMessage`

**功能描述**：设置分享页信息（用于分享转发，全局一份）

### 参数类型: `SetSharePageMessageOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `sharePage` | `WxSharePageInfo` | ✅ 是 | 分享页信息 |
| `  . title` | `string` | ⬜ 否 |  |
| `  . path` | `string` | ⬜ 否 |  |
| `  . imageUrl` | `string` | ⬜ 否 |  |
| `  . desc` | `string` | ⬜ 否 |  |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `showShareImageMenu`

**功能描述**：显示图片分享菜单

### 参数类型: `ShowShareImageMenuOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `path` | `string` | ✅ 是 | 图片路径 |
| `style` | `string` | ✅ 是 | 样式 |
| `needShowEntrance` | `string` | ✅ 是 | 是否需要显示入口 |
| `entrancePath` | `string` | ✅ 是 | 入口路径 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `getClipboardData`

**功能描述**：读取剪贴板内容

### 参数类型: `BaseOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `string`

---

## `setClipboardData`

**功能描述**：写入剪贴板

### 参数类型: `SetClipboardDataOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `data` | `string` | ✅ 是 | 剪贴板内容 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `startAudioRecord`

**功能描述**：开始录音

### 参数类型: `StartAudioRecordOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `duration` | `number` | ⬜ 否 | 录音时长（毫秒） |
| `sampleRate` | `number` | ⬜ 否 | 采样率 |
| `numberOfChannels` | `number` | ⬜ 否 | 通道数 |
| `encodeBitRate` | `number` | ⬜ 否 | 编码码率 |
| `format` | `string` | ⬜ 否 | 音频格式 |
| `frameSize` | `number` | ⬜ 否 | 帧大小 |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `stopAudioRecord`

**功能描述**：停止录音，返回录音文件临时路径

### 参数类型: `BaseOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `string`

---

## `pauseAudioRecord`

**功能描述**：暂停录音

### 参数类型: `BaseOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

## `resumeAudioRecord`

**功能描述**：继续录音

### 参数类型: `BaseOptions`

| 字段名 | 类型 | 必填 | 描述 |
| --- | --- | --- | --- |
| `timeout` | `number` | ⬜ 否 | 超时时间（毫秒），默认 60000ms |

### 返回类型: `void`

---

