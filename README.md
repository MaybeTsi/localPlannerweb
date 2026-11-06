# 测试场景库网页（Scenario Library）

静态网页，直接用浏览器打开 `index.html` 即可，不需要服务器，不加载外部库或字体。

- **导航**：左上角竖排的集合列表（宽屏时一直放在左侧留白里；窄屏和手机上平时收成小胶囊，点开向下展开，选好后自动收回；键盘 S 切换）。列表末尾是「概览」和「分析」。正文居中，最宽 1280 px，左右留白是走廊线稿和占据栅格的装饰图，底部页脚写本次构建的 B / C / D 提交号。地址栏加 `?nav=top|tiles|mini|title|rail` 可看其他导航方案（仅供对比）。
- **列表**：上方的子集分段（锁定留出：原包 / 补包；S2：医院 / 办公室；S3：c 值；S4：F0–F6；开发集：S1 / S4）、指令类型条（①–⑭、⑮ 方向指令）、某方法的结局、"只看有轨迹"。每张卡片有地图缩略图、指令文字和本集合各方法的成败条（鼠标悬停时播放所选方法的轨迹）。卡片上方三张指标卡跟随所选集合和子集；S4 各族的成功率 B 不合并，所以只有选了某一族才显示。
- **详情**：俯视图（墙或建筑栅格、障碍、开口编号、起点、字面落点、本方法首次承诺时的候选与后验）；"显示答案"开关（已评分集合和公开开发集可用；⑮ 显示为方向箭头）；各方法轨迹可逐个开关；叠加 / 并排 / 拉杆三种视图；时间轴回放；B 的意图 / 字面 / 无接触评分；本组的分类型成功率；被选作机制视频的用例显示 D 的关键帧。S2 的门编号显示为 d1、d2…，完整 id 列在方法表下方。
- **概览**：各集合 × 类型的用例数（逐条计数，并列出 LIBRARY_MANIFEST 总数）；各方法意图成功，可在 20 个统计数据集间切换（锁定留出及其分项、S1、S2 及两栋楼、S3 及两档 c、S4 各族），格内是"成功 / 槽位"，悬停显示 B 的主估计和 95% 区间；逐例点阵；S4 场景族图；数据来源；机制视频选例。

- **分析**（`#analysis`）：数据分析章节。0 为 2026-11-01 已有图（原样引用），1–5 为 2026-11-02 追加：测试集长什么样、障碍物和特殊地形、S5（method_v3）、测试集可靠性、Isaac 第一批终版。每节一张图或一张表加两三句说明，卡片下方列出数据来源。文字在 `data/analysis.js`，图片在 `analysis/`（复制自 `docs/mainline/figs_analysis_20261101/` 与 `figs_analysis_20261102/`，出图代码和逐个数字的出处在那两个目录）。

## 数据来源（只读）

| 内容 | 分支 | 路径 |
|---|---|---|
| 用例（地图、起点、指令文字、候选、答案），全部集合 | B `codex/kappa-facts-20261028` | `research/scenario_library/library_index.json`（JSON Lines）、`LIBRARY_MANIFEST.json` |
| 锁定留出评分、成功率 | B | `research/locked_eval_stats_20261104/CP_B3_20261030/scores.jsonl`、`statistics.json` |
| S1–S3 评分、成功率 | B | `research/fresh_tests_20261101/scores/S{1,2,3}_SCORES.jsonl`、`statistics/SUMMARY.json`、`statistics/STRATIFIED.jsonl` |
| S4 评分、成功率 | B | `research/fresh_tests_20261101/S4_scores/S4_F{0..6}_SCORES.jsonl`、`S4_statistics/SUMMARY.json`、`S4_statistics/STRATIFIED.jsonl` |
| 轨迹、本方法候选与后验 | C `codex/junction-decision-20261028` | 每条 B 评分记录里的 `source_file` / `source_record`（C 原始记录）及其 `diagnostic_log_path`；网页不再逐条保存这个路径，按用例编号和臂名到 B 的评分文件里查即可 |
| S2 建筑栅格 | C | `tools/eval/truth/{hospital,office}_truth.npz`（0.1 m；占据 / 空闲 / 未知） |
| 机制视频选例与关键帧 | D `codex/isaac-video-20261029` | `research/isaac_video_20261029/mechanism_20261031/{selection.json,series_selection.json,frames/}` |

每次构建所用的三个提交号写在 `data/meta.js`，侧栏底部和概览页也会显示。B 在锁定留出集上重跑的 v2（`locked_*_SCORES.jsonl`）被 B 标为"修改依据来自这些用例，仅供参考"，网页不收。

## 重建

```bash
git fetch origin +refs/heads/codex/kappa-facts-20261028:refs/remotes/origin/codex/kappa-facts-20261028
git fetch origin +refs/heads/codex/junction-decision-20261028:refs/remotes/origin/codex/junction-decision-20261028
git fetch origin +refs/heads/codex/isaac-video-20261029:refs/remotes/origin/codex/isaac-video-20261029
python3 tools/build_data.py            # 约 5 分钟；生成 data/ 与 frames/
python3 tools/make_family_figure.py    # 生成 scenario_families_F1-F6.{png,pdf,svg}（需要 matplotlib）
node tools/screenshots.js              # 可选：更新 screenshots/
```

轨迹：所有已评分用例（锁定留出 2,160、S1–S4 共 4,405）的全部方法轨迹都已收录，共 66,710 条；开发集 185 条没有 B 的评分，也不收轨迹。轨迹按差值 + 变长整数编码成 base64 字符串（无损，精度仍为 1 cm / 0.01 s / 0.01 rad），每 40 条用例一个文件放在 `data/traj/`；评分单独放在 `data/cases/`。网页在卡片接近屏幕时才加载对应的轨迹文件，画图时才解码并限量缓存；缩略图每帧只画几张，画好后缓存，屏幕外的卡片不参与排版。数据合计约 35 MB。`build_data.py --s-traj N` 可改回每组只收 N 条。

## 规则

- 不读取、不保存任何私有种子；答案只对已评分集合（锁定留出、B 独立评分完成的 S1–S4）和明确公开的开发集显示。
- 页面上的成功率、用例数直接取自上表文件，旁边注明来源；网页不写结论。
- 轨迹是 C 保存的真实运行记录（含时间戳），只做简化不做插值生成：Ramer–Douglas–Peucker 在 (x, y, 1.0·t, 0.15·yaw) 上，阈值 0.005；抽查同一时刻位置误差小于 1 cm。
- F1–F6 图画的是每族第一条 S4 开发集用例（B 已发放、答案公开）的场景库地图，不是示意。

## 设计

配色"Signal"（白底＋国际橙）；标题图标为“用例卡片堆叠”（橙底三张错开的卡片，最上面一张画着转弯轨迹）；导航为左上角竖排列表，指令类型选择放在列表上方的类型条，下面一行列出当前筛选条件。动效取自 video-shotcraft 仓库的 demo（分段控件、类型筛选、DigitRoll、标题词槽、卡片入场、悬停轨迹、显示答案、承诺定格、拉杆、逐例点阵）。开启系统"减少动态效果"时动效关闭。

## S10 与主方法 v6（2026-11-06 更新）

- 首页 `#s10`：S10 排行榜，按子集分开（主集 3000、偏移三轴各 600、杂物 600、大厅/拐角各 400、真实地图及医院/办公室）。每个子集：平均得分、完成率（确认完成 / 全部生成槽位）、参考一致率、严重错误率，取自 B `e926eea6` 的 `research/s10_20261105/FORMAL_RATES.csv`。
- 详情 `#s10case/<id>`：地图、指令、字面可行性、参考决策、各方法行为与得分着色、“显示真实意图”开关（默认关）、“你认为该怎么做”（只存浏览器本地）。B 未导出的字段（真实意图、候选结构几何、后验、三种做法的期望得分）显示“未导出”。
- 概览：混淆表、按歧义分层得分、各子集 v6 − 字面可行就照字面；v4 及更早实验折叠在“上一版（v4）及更早的实验”里。
- 构建：`python3 tools/build_s10.py`（约 7 分钟，生成 `data/s10/`，约 35 MB；S10 的 8,915 题 × 7 个方法共 62,404 条轨迹全部收录（其余 1 个槽位在 C 的记录里没有轨迹））。
- 手机：指令类型条改为单行横滑、不再固定在顶部。
