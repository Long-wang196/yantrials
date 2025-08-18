# 闫浩文教授学术与成长轨迹可视化

这是一个基于 Leaflet.js 的交互式地图项目，旨在生动、动态地展示闫浩文教授的学术生涯与人生足迹。通过动画轨迹、时间轴控制和信息面板的联动，用户可以直观地了解其从出生地到世界各地求学、工作的完整历程。

[**➡️ 点击查看在线演示 (View Live Demo)**](https://your-demo-link.com) <!-- 请将 # 替换为您的实际演示链接 -->

![项目截图](https://user-images.githubusercontent.com/your-username/your-repo/assets/screenshot.gif) <!-- 请替换为您的项目截图或GIF动图链接 -->

---

## 核心功能

- **🗺️ 交互式地图**：基于 Leaflet.js 构建，支持多种地图底图切换（高德、OSM、卫星图等）。
- **✈️ 动态轨迹动画**：以平滑的曲线和动态的交通工具图标（飞机、火车等）展示移动过程。
- **▶️ 播放控制**：提供播放/暂停、重置、倍速播放等功能，并支持快捷键操作。
- **📊 实时信息同步**：地图动画与右侧的统计面板、进度条和轨迹详情列表实时同步更新。
- **📈 数据统计**：自动计算并展示地点总数、历程时间、交通方式种类等关键数据。
- **🌐 智能路径规划**：跨洲际的移动会生成更符合现实的弧形飞行路线。
- **📱 响应式设计**：完美适配桌面和移动设备，提供一致的用户体验。
- **🔧 易于定制**：轨迹数据通过外部 `GeoJSON` 文件加载，方便用户替换为自己的数据。

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6)
- **地图库**: [Leaflet.js](https://leafletjs.com/)
- **数据格式**: GeoJSON

## 项目结构

项目代码已被清晰地拆分为三个核心文件，便于维护和修改：

```
.
├── 📂assets/                  # (建议) 存放静态资源
│   ├── Yan_trails.geojson    # 核心轨迹数据文件
│   ├── plane.svg             # 飞机图标
│   ├── train.svg             # 火车图标
│   └── ... (其他图标)
├── index.html                # HTML 结构文件
├── style.css                 # CSS 样式文件
└── script.js                 # JavaScript 逻辑文件
└── README.md                 # 项目说明文件
```

## 如何本地运行

1.  **克隆仓库**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    ```
2.  **准备数据和图标**
    - 确保 `Yan_trails.geojson` 数据文件存在。
    - 确保 `plane.svg`, `train.svg` 等图标文件存在，并与 `script.js` 中的路径引用一致。
3.  **打开页面**
    - 直接在现代浏览器中打开 `index.html` 文件即可查看效果。由于项目不依赖复杂的后端服务，通常不需要启动本地服务器。

## 如何定制为你自己的轨迹图

您可以非常轻松地将此项目修改为您自己的个人轨迹图。

1.  **准备数据**: 打开 `Yan_trails.geojson` 文件。它是一个标准的 GeoJSON `FeatureCollection`。
2.  **修改数据点**: 每一个 `Feature` 对象代表一个地点和事件。您需要修改 `properties` 和 `geometry` 字段。

    一个数据点的基本结构如下：
    ```json
    {
      "type": "Feature",
      "properties": {
        "时间段": "2010.03 - 2014.06",
        "地点": "加拿大滑铁卢",
        "事件": "滑铁卢大学",
        "transport_mode": "plane" 
      },
      "geometry": {
        "type": "Point",
        "coordinates": [ -80.52041, 43.46426 ] 
      }
    }
    ```
    - `时间段`, `地点`, `事件`: 将被显示在右侧信息面板中。
    - `transport_mode`: 从该点到下一个点所使用的交通方式。可选值为 `plane`, `train`, `bus`, `bicycle`, `walk`。这将决定移动图标的样式和动画。
    - `coordinates`: 坐标，格式为 `[经度, 纬度]`。

3.  **保存并刷新**: 保存您修改后的 `.geojson` 文件，然后刷新 `index.html` 页面即可看到您的专属轨迹图！

## 许可协议

本项目基于 [MIT License](LICENSE) 开源。

---
---

# Prof. Yan Haowen's Academic Trajectory Visualization

This is an interactive map project built with Leaflet.js, designed to dynamically visualize the academic and life journey of Professor Yan Haowen. Through animated trajectories, timeline controls, and a synchronized information panel, users can intuitively follow his path from his birthplace to various institutions for study and work around the world.

[**➡️ View Live Demo**](https://your-demo-link.com) <!-- Replace # with your actual demo link -->

![Project Screenshot](https://user-images.githubusercontent.com/your-username/your-repo/assets/screenshot.gif) <!-- Replace this with a link to your project's screenshot or GIF -->

---

## Core Features

- **🗺️ Interactive Map**: Built on Leaflet.js, supporting multiple base map layers (e.g., AutoNavi, OSM, Satellite).
- **✈️ Dynamic Trajectory Animation**: Displays the journey with smooth, curved paths and animated vehicle icons (planes, trains, etc.).
- **▶️ Playback Controls**: Features play/pause, reset, and speed control functionalities, with keyboard shortcuts supported.
- **📊 Real-time Info Sync**: The map animation is synchronized in real-time with the statistics panel, progress bar, and detailed trajectory list on the right.
- **📈 Data Statistics**: Automatically calculates and displays key metrics like total locations, journey duration in years, and number of transport modes used.
- **🌐 Realistic Path Rendering**: Intercontinental travel paths are rendered as realistic curved arcs.
- **📱 Responsive Design**: Provides a consistent and seamless user experience across both desktop and mobile devices.
- **🔧 Easy to Customize**: Trajectory data is loaded from an external `GeoJSON` file, making it easy for users to replace it with their own data.

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6)
- **Map Library**: [Leaflet.js](https://leafletjs.com/)
- **Data Format**: GeoJSON

## Project Structure

The project's codebase is clearly organized into three core files for easy maintenance and modification:

```
.
├── 📂assets/                  # (Recommended) For static assets
│   ├── Yan_trails.geojson    # The core trajectory data file
│   ├── plane.svg             # Plane icon
│   ├── train.svg             # Train icon
│   └── ... (other icons)
├── index.html                # HTML structure file
├── style.css                 # CSS styles file
└── script.js                 # JavaScript logic file
└── README.md                 # Project documentation
```

## Getting Started

To run this project locally, follow these simple steps:

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    ```
2.  **Prepare Data and Icons**
    - Ensure the `Yan_trails.geojson` data file is present.
    - Ensure the `plane.svg`, `train.svg`, and other icon files are available and their paths in `script.js` are correct.
3.  **Open the Page**
    - Simply open the `index.html` file in any modern web browser. No local server is typically required as the project has no complex backend dependencies.

## How to Customize with Your Own Trajectory

You can easily adapt this project to visualize your own personal journey.

1.  **Prepare Your Data**: Open the `Yan_trails.geojson` file. It's a standard GeoJSON `FeatureCollection`.
2.  **Modify Data Points**: Each `Feature` object represents a location and an event. You'll need to edit the `properties` and `geometry` fields.

    The basic structure of a data point is as follows:
    ```json
    {
      "type": "Feature",
      "properties": {
        "时间段": "2010.03 - 2014.06", // "Time Period"
        "地点": "Waterloo, Canada",      // "Location"
        "事件": "University of Waterloo", // "Event"
        "transport_mode": "plane" 
      },
      "geometry": {
        "type": "Point",
        "coordinates": [ -80.52041, 43.46426 ] 
      }
    }
    ```
    - `时间段`, `地点`, `事件`: These will be displayed in the right-side information panel. Feel free to change the keys and update the `script.js` accordingly if you prefer English keys.
    - `transport_mode`: The mode of transport used from this point to the next. Valid options are `plane`, `train`, `bus`, `bicycle`, and `walk`. This determines the icon's style and animation.
    - `coordinates`: The geographical coordinates in `[longitude, latitude]` format.

3.  **Save and Refresh**: Save your modified `.geojson` file and refresh the `index.html` page in your browser to see your personalized trajectory map!

## License

This project is licensed under the [MIT License](LICENSE).
