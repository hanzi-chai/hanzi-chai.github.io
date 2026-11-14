/**
 * 214 个康熙部首的实际字形表，编号按康熙部首顺序（1–214）。
 * 同时收录本字、偏旁、简化形和显式列出的形近写法；归部必须查本表，
 * 不能仅凭字符位于康熙部首区或对字符执行 NFKC 推断。
 * 初始字形 ID 对应 data 字库快照；迁移 ID 时须同步改写本表。
 * Unicode 对应关系参考 https://www.unicode.org/Public/18.0.0/ucd/CJKRadicals.txt 。
 * 偏旁变体参考 https://www.unicode.org/Public/18.0.0/charts/nameslist/2e80/ 。
 * 共用字形固定归部：506 → 日、743 → 网；耳旁 162 按左右位置消歧。
 */
export interface 康熙部首定义 {
  number: number;
  name: string;
  glyph_ids: readonly number[];
}

export const 康熙部首表: readonly 康熙部首定义[] = [
  // 一⼀
  { number: 1, name: "一", glyph_ids: [0x00000] },
  // 丨⼁
  { number: 2, name: "丨", glyph_ids: [0x00002] },
  // 丶⼂⺀
  { number: 3, name: "丶", glyph_ids: [0x00006, 0x00173] },
  // 丿⼃
  { number: 4, name: "丿", glyph_ids: [0x00004] },
  // 乙⼄⺂⺃⺄乚乛
  { number: 5, name: "乙", glyph_ids: [0x0000c, 0x00010, 0x00015, 0x0001e] },
  // 亅⼅
  { number: 6, name: "亅", glyph_ids: [0x00003] },
  // 二⼆
  { number: 7, name: "二", glyph_ids: [0x00100] },
  // 亠⼇
  { number: 8, name: "亠", glyph_ids: [0x0016e] },
  // 人⼈⺅亻
  { number: 9, name: "人", glyph_ids: [0x00137, 0x00145] },
  // 儿⼉
  { number: 10, name: "儿", glyph_ids: [0x0014f] },
  // 入⼊
  { number: 11, name: "入", glyph_ids: [0x00147] },
  // 八⼋
  { number: 12, name: "八", glyph_ids: [0x00143] },
  // 冂⼌⺆
  { number: 13, name: "冂", glyph_ids: [0x00130, 0x0014c] },
  // 冖⼍
  { number: 14, name: "冖", glyph_ids: [0x00175] },
  // 冫⼎
  { number: 15, name: "冫", glyph_ids: [0x0016d] },
  // 几⼏⺇
  { number: 16, name: "几", glyph_ids: [0x0014d, 0x00151] },
  // 凵⼐
  { number: 17, name: "凵", glyph_ids: [0x0017e] },
  // 刀⼑⺈⺉刂
  { number: 18, name: "刀", glyph_ids: [0x00124, 0x0014e, 0x00188] },
  // 力⼒
  { number: 19, name: "力", glyph_ids: [0x00189] },
  // 勹⼓
  { number: 20, name: "勹", glyph_ids: [0x00153] },
  // 匕⼔
  { number: 21, name: "匕", glyph_ids: [0x00154, 0x0011d] },
  // 匚⼕
  { number: 22, name: "匚", glyph_ids: [0x00112] },
  // 匸⼖
  { number: 23, name: "匸", glyph_ids: [0x00113] },
  // 十⼗
  { number: 24, name: "十", glyph_ids: [0x00105] },
  // 卜⼘⺊
  { number: 25, name: "卜", glyph_ids: [0x0011f, 0x0012c] },
  // 卩⼙⺋㔾
  { number: 26, name: "卩", glyph_ids: [0x0017f, 0x001a5] },
  // 厂⼚⺁
  { number: 27, name: "厂", glyph_ids: [0x0010a, 0x0013f] },
  // 厶⼛
  { number: 28, name: "厶", glyph_ids: [0x00197] },
  // 又⼜
  { number: 29, name: "又", glyph_ids: [0x00198] },
  // 口⼝
  { number: 30, name: "口", glyph_ids: [0x00258] },
  // 囗⼞
  { number: 31, name: "囗", glyph_ids: [0x00259] },
  // 土⼟
  { number: 32, name: "土", glyph_ids: [0x0020e] },
  // 士⼠
  { number: 33, name: "士", glyph_ids: [0x0020f] },
  // 夂⼡
  { number: 34, name: "夂", glyph_ids: [0x00291] },
  // 夊⼢
  { number: 35, name: "夊", glyph_ids: [0x00292] },
  // 夕⼣
  { number: 36, name: "夕", glyph_ids: [0x00290] },
  // 大⼤
  { number: 37, name: "大", glyph_ids: [0x00227] },
  // 女⼥
  { number: 38, name: "女", glyph_ids: [0x002da] },
  // 子⼦
  { number: 39, name: "子", glyph_ids: [0x002ce] },
  // 宀⼧
  { number: 40, name: "宀", glyph_ids: [0x002b5] },
  // 寸⼨
  { number: 41, name: "寸", glyph_ids: [0x0021d] },
  // 小⼩⺌⺍
  { number: 42, name: "小", glyph_ids: [0x00250, 0x00254, 0x002b0] },
  // 尢⼪⺎⺏⺐⺑
  { number: 43, name: "尢", glyph_ids: [0x0022d, 0x0022e, 0x0a102, 0x10105] },
  // 尸⼫
  { number: 44, name: "尸", glyph_ids: [0x002c2] },
  // 屮⼬
  { number: 45, name: "屮", glyph_ids: [0x002d3, 0x002d5] },
  // 山⼭
  { number: 46, name: "山", glyph_ids: [0x00261] },
  // 巛⼮
  { number: 47, name: "巛", glyph_ids: [0x002f4] },
  // 工⼯
  { number: 48, name: "工", glyph_ids: [0x00210] },
  // 己⼰⺒已巳
  { number: 49, name: "己", glyph_ids: [0x002c7, 0x002c9, 0x002cb] },
  // 巾⼱
  { number: 50, name: "巾", glyph_ids: [0x00262] },
  // 干⼲
  { number: 51, name: "干", glyph_ids: [0x00202] },
  // 幺⼳⺓
  { number: 52, name: "幺", glyph_ids: [0x002f3] },
  // 广⼴
  { number: 53, name: "广", glyph_ids: [0x002a5] },
  // 廴⼵
  { number: 54, name: "廴", glyph_ids: [0x00199] },
  // 廾⼶
  { number: 55, name: "廾", glyph_ids: [0x00224] },
  // 弋⼷
  { number: 56, name: "弋", glyph_ids: [0x0023f] },
  // 弓⼸
  { number: 57, name: "弓", glyph_ids: [0x002ca] },
  // 彐⼹⺔⺕彑
  { number: 58, name: "彐", glyph_ids: [0x002bb, 0x002be, 0x002ef] },
  // 彡⼺
  { number: 59, name: "彡", glyph_ids: [0x0027f] },
  // 彳⼻
  { number: 60, name: "彳", glyph_ids: [0x0027e] },
  // 心⼼⺖⺗忄㣺
  { number: 61, name: "心", glyph_ids: [0x002af, 0x00366, 0x00367, 0x003e9] },
  // 戈⼽
  { number: 62, name: "戈", glyph_ids: [0x00347] },
  // 戶⼾户戸
  { number: 63, name: "戶", glyph_ids: [0x003ad, 0x003e3, 0x01244] },
  // 手⼿⺘扌龵
  { number: 64, name: "手", glyph_ids: [0x0020d, 0x00385, 0x0038a] },
  // 支⽀
  { number: 65, name: "支", glyph_ids: [0x18111] },
  // 攴⽁⺙
  { number: 66, name: "攴", glyph_ids: [0x1910a, 0x04208] },
  // 文⽂
  { number: 67, name: "文", glyph_ids: [0x003d1] },
  // 斗⽃
  { number: 68, name: "斗", glyph_ids: [0x003dd] },
  // 斤⽄
  { number: 69, name: "斤", glyph_ids: [0x1b111] },
  // 方⽅
  { number: 70, name: "方", glyph_ids: [0x0810e] },
  // 无⽆⺛旡
  { number: 71, name: "无", glyph_ids: [0x00311, 0x0034c, 0x0041c] },
  // 日⽇⺜
  { number: 72, name: "日", glyph_ids: [0x0036a, 0x00371] },
  // 曰⽈
  { number: 73, name: "曰", glyph_ids: [0x0036b] },
  // 月⽉⺝
  { number: 74, name: "月", glyph_ids: [0x00368, 0x003b2] },
  // 木⽊
  { number: 75, name: "木", glyph_ids: [0x0032b] },
  // 欠⽋
  { number: 76, name: "欠", glyph_ids: [0x09139] },
  // 止⽌
  { number: 77, name: "止", glyph_ids: [0x00355] },
  // 歹⽍⺞
  { number: 78, name: "歹", glyph_ids: [0x0033d, 0x19207] },
  // 殳⽎
  { number: 79, name: "殳", glyph_ids: [0x1011b] },
  // 毋⽏⺟母
  { number: 80, name: "毋", glyph_ids: [0xd700d, 0xd7010, 0x004cf] },
  // 比⽐
  { number: 81, name: "比", glyph_ids: [0x15104, 0x15102] },
  // 毛⽑
  { number: 82, name: "毛", glyph_ids: [0x0038e] },
  // 氏⽒⺠民
  { number: 83, name: "氏", glyph_ids: [0x003b5, 0x004c2] },
  // 气⽓
  { number: 84, name: "气", glyph_ids: [0x0038f] },
  // 水⽔⺡⺢氵氺
  { number: 85, name: "水", glyph_ids: [0x002ae, 0x0037c, 0x0044e] },
  // 火⽕⺣灬
  { number: 86, name: "火", glyph_ids: [0x003d9, 0x003e0] },
  // 爪⽖⺤⺥爫
  { number: 87, name: "爪", glyph_ids: [0x003a9, 0x2a009, 0x1b116] },
  // 父⽗
  { number: 88, name: "父", glyph_ids: [0x0422b] },
  // 爻⽘
  { number: 89, name: "爻", glyph_ids: [0x0422c] },
  // 爿⽙⺦丬
  { number: 90, name: "爿", glyph_ids: [0x002a4, 0xd7001] },
  // 片⽚
  { number: 91, name: "片", glyph_ids: [0x003a1] },
  // 牙⽛
  { number: 92, name: "牙", glyph_ids: [0x00343, 0x00418] },
  // 牛⽜⺧牜
  { number: 93, name: "牛", glyph_ids: [0x00386, 0x00395, 0x00399] },
  // 犬⽝⺨犭
  { number: 94, name: "犬", glyph_ids: [0x0028d, 0x00339] },
  // 玄⽞
  { number: 95, name: "玄", glyph_ids: [0x08220] },
  // 玉⽟⺩王
  { number: 96, name: "玉", glyph_ids: [0x00306, 0x00307, 0x00405] },
  // 瓜⽠
  { number: 97, name: "瓜", glyph_ids: [0x00499] },
  // 瓦⽡
  { number: 98, name: "瓦", glyph_ids: [0x0034f] },
  // 甘⽢
  { number: 99, name: "甘", glyph_ids: [0x0041d] },
  // 生⽣
  { number: 100, name: "生", glyph_ids: [0x00487] },
  // 用⽤
  { number: 101, name: "用", glyph_ids: [0x004a0] },
  // 田⽥
  { number: 102, name: "田", glyph_ids: [0x00464] },
  // 疋⽦⺪
  { number: 103, name: "疋", glyph_ids: [0x004c6, 0x004c8] },
  // 疒⽧
  { number: 104, name: "疒", glyph_ids: [0x004ae] },
  // 癶⽨
  { number: 105, name: "癶", glyph_ids: [0x0536a] },
  // 白⽩
  { number: 106, name: "白", glyph_ids: [0x00493] },
  // 皮⽪
  { number: 107, name: "皮", glyph_ids: [0x1d217] },
  // 皿⽫
  { number: 108, name: "皿", glyph_ids: [0x00479] },
  // 目⽬⺫
  { number: 109, name: "目", glyph_ids: [0x00451] },
  // 矛⽭
  { number: 110, name: "矛", glyph_ids: [0x004cd] },
  // 矢⽮
  { number: 111, name: "矢", glyph_ids: [0x25116] },
  // 石⽯
  { number: 112, name: "石", glyph_ids: [0x1e103] },
  // 示⽰⺬⺭礻
  { number: 113, name: "示", glyph_ids: [0x003e6, 0x00409] },
  // 禸⽱
  { number: 114, name: "禸", glyph_ids: [0x00383, 0x00477] },
  // 禾⽲
  { number: 115, name: "禾", glyph_ids: [0x0048d] },
  // 穴⽳
  { number: 116, name: "穴", glyph_ids: [0x28104] },
  // 立⽴
  { number: 117, name: "立", glyph_ids: [0x08217] },
  // 竹⽵⺮
  { number: 118, name: "竹", glyph_ids: [0x0442b, 0x04414] },
  // 米⽶
  { number: 119, name: "米", glyph_ids: [0x00572] },
  // 糸⽷⺯⺰纟糹
  { number: 120, name: "糸", glyph_ids: [0x002f0, 0x34204, 0x34209] },
  // 缶⽸
  { number: 121, name: "缶", glyph_ids: [0x0054e] },
  // 网⽹⺱⺲⺳⺴⺵罒罓
  {
    number: 122,
    name: "网",
    glyph_ids: [0x00478, 0x02220, 0x0e109, 0x0e10e, 0x0221c, 0x0d31c],
  },
  // 羊⽺⺶⺷⺸
  { number: 123, name: "羊", glyph_ids: [0x0341b, 0x0341c, 0x60118, 0x8c258] },
  // 羽⽻
  { number: 124, name: "羽", glyph_ids: [0x0f325, 0x0547b] },
  // 老⽼⺹耂
  { number: 125, name: "老", glyph_ids: [0x0031e, 0x7d104, 0x7d102] },
  // 而⽽
  { number: 126, name: "而", glyph_ids: [0x01466] },
  // 耒⽾
  { number: 127, name: "耒", glyph_ids: [0x00500, 0x0054d] },
  // 耳⽿
  { number: 128, name: "耳", glyph_ids: [0x0050b] },
  // 聿⾀⺺⺻
  { number: 129, name: "聿", glyph_ids: [0x003ec, 0x004bd, 0x00577] },
  // 肉⾁⺼
  { number: 130, name: "肉", glyph_ids: [0x003c2, 0x0930e] },
  // 臣⾂
  { number: 131, name: "臣", glyph_ids: [0x00514] },
  // 自⾃
  { number: 132, name: "自", glyph_ids: [0x00554] },
  // 至⾄
  { number: 133, name: "至", glyph_ids: [0x20243] },
  // 臼⾅⺽
  { number: 134, name: "臼", glyph_ids: [0x00551, 0x0451f] },
  // 舌⾆
  { number: 135, name: "舌", glyph_ids: [0x33202, 0x1e263] },
  // 舛⾇
  { number: 136, name: "舛", glyph_ids: [0x24209, 0x24309] },
  // 舟⾈
  { number: 137, name: "舟", glyph_ids: [0x00564, 0x00563] },
  // 艮⾉
  { number: 138, name: "艮", glyph_ids: [0x0057c] },
  // 色⾊
  { number: 139, name: "色", glyph_ids: [0x12338] },
  // 艸⾋⺾⺿⻀艹
  { number: 140, name: "艸", glyph_ids: [0x00215, 0x18103, 0x19104, 0x2d20f] },
  // 虍⾌⻁
  { number: 141, name: "虍", glyph_ids: [0x1930b, 0x8d105] },
  // 虫⾍
  { number: 142, name: "虫", glyph_ids: [0x0053c] },
  // 血⾎
  { number: 143, name: "血", glyph_ids: [0x0055b] },
  // 行⾏
  { number: 144, name: "行", glyph_ids: [0x3c200] },
  // 衣⾐⻂衤
  { number: 145, name: "衣", glyph_ids: [0x004b9, 0x08324] },
  // 襾⾑⻃⻄西覀
  { number: 146, name: "襾", glyph_ids: [0x00518, 0x00519, 0x0051d] },
  // 見⾒⻅见
  { number: 147, name: "見", glyph_ids: [0x02224, 0x6d10c] },
  // 角⾓⻆⻇
  { number: 148, name: "角", glyph_ids: [0x1243f, 0x12440, 0x1253f] },
  // 言⾔⻈讠訁
  { number: 149, name: "言", glyph_ids: [0x00176, 0x08405, 0x07401] },
  // 谷⾕
  { number: 150, name: "谷", glyph_ids: [0x1e3ed] },
  // 豆⾖
  { number: 151, name: "豆", glyph_ids: [0x01544] },
  // 豕⾗
  { number: 152, name: "豕", glyph_ids: [0x00622, 0x00626] },
  // 豸⾘
  { number: 153, name: "豸", glyph_ids: [0x00647] },
  // 貝⾙⻉贝
  { number: 154, name: "貝", glyph_ids: [0x0221f, 0x6d109] },
  // 赤⾚
  { number: 155, name: "赤", glyph_ids: [0x20330, 0x20348] },
  // 走⾛
  { number: 156, name: "走", glyph_ids: [0x2032d] },
  // 足⾜⻊𧾷
  { number: 157, name: "足", glyph_ids: [0x1e353, 0x1e355] },
  // 身⾝
  { number: 158, name: "身", glyph_ids: [0x0063c] },
  // 車⾞⻋车
  { number: 159, name: "車", glyph_ids: [0x00340, 0x0060e] },
  // 辛⾟
  { number: 160, name: "辛", glyph_ids: [0x08421] },
  // 辰⾠
  { number: 161, name: "辰", glyph_ids: [0x1b405] },
  // 辵⾡⻌⻍⻎辶
  { number: 162, name: "辵", glyph_ids: [0x002b7, 0x002b8, 0x003e2, 0x3b308] },
  // 邑⾢⻏
  { number: 163, name: "邑", glyph_ids: [0x0017d, 0x1e3d4] },
  // 酉⾣
  { number: 164, name: "酉", glyph_ids: [0x0061c, 0x0061d] },
  // 釆⾤
  { number: 165, name: "釆", glyph_ids: [0x00646] },
  // 里⾥
  { number: 166, name: "里", glyph_ids: [0x00631] },
  // 金⾦⻐钅釒
  { number: 167, name: "金", glyph_ids: [0x00486, 0x04656] },
  // 長⾧⻑⻒⻓长
  { number: 168, name: "長", glyph_ids: [0x0039e, 0x1c400, 0x01631] },
  // 門⾨⻔门
  { number: 169, name: "門", glyph_ids: [0x002a8, 0x02627] },
  // 阜⾩⻕⻖阝
  { number: 170, name: "阜", glyph_ids: [0x0017d, 0x04449, 0x1852f] },
  // 隶⾪
  { number: 171, name: "隶", glyph_ids: [0x00728] },
  // 隹⾫
  { number: 172, name: "隹", glyph_ids: [0x00721, 0x00720] },
  // 雨⾬⻗
  { number: 173, name: "雨", glyph_ids: [0x0070c, 0x00711, 0x0070b] },
  // 靑⾭⻘青
  { number: 174, name: "靑", glyph_ids: [0x4a301, 0x0160a, 0x0160b, 0x4a302] },
  // 非⾮
  { number: 175, name: "非", glyph_ids: [0x02607, 0x0460a] },
  // 面⾯
  { number: 176, name: "面", glyph_ids: [0x1f500] },
  // 革⾰
  { number: 177, name: "革", glyph_ids: [0x00803] },
  // 韋⾱⻙韦
  { number: 178, name: "韋", glyph_ids: [0x00316, 0xd7173, 0xd71ff] },
  // 韭⾲
  { number: 179, name: "韭", glyph_ids: [0xaf000] },
  // 音⾳
  { number: 180, name: "音", glyph_ids: [0x75311] },
  // 頁⾴⻚页
  { number: 181, name: "頁", glyph_ids: [0x9a100, 0x6d303] },
  // 風⾵⻛风
  { number: 182, name: "風", glyph_ids: [0x1010f, 0x10614, 0x10611] },
  // 飛⾶⻜飞
  { number: 183, name: "飛", glyph_ids: [0x002e0, 0xb7502] },
  // 食⾷⻝⻞⻟⻠饣飠
  {
    number: 184,
    name: "食",
    glyph_ids: [0x002a2, 0x8a204, 0x04767, 0x04763, 0x04662, 0x8a203, 0x016ed],
  },
  // 首⾸⻡
  { number: 185, name: "首", glyph_ids: [0x8420a, 0x2f603] },
  // 香⾹
  { number: 186, name: "香", glyph_ids: [0x7331b, 0x7331c] },
  // 馬⾺⻢马
  { number: 187, name: "馬", glyph_ids: [0x002f1, 0x56502] },
  // 骨⾻⻣
  { number: 188, name: "骨", glyph_ids: [0x4a413, 0x4a506, 0x82507] },
  // 高⾼
  { number: 189, name: "高", glyph_ids: [0x0872c] },
  // 髟⾽
  { number: 190, name: "髟", glyph_ids: [0xa8200] },
  // 鬥⾾
  { number: 191, name: "鬥", glyph_ids: [0x0280d] },
  // 鬯⾿
  { number: 192, name: "鬯", glyph_ids: [0x1572d, 0x1572c] },
  // 鬲⿀
  { number: 193, name: "鬲", glyph_ids: [0x01868, 0x01867] },
  // 鬼⿁⻤
  { number: 194, name: "鬼", glyph_ids: [0x1c60c, 0x1c706] },
  // 魚⿂⻥鱼
  { number: 195, name: "魚", glyph_ids: [0x016f1, 0x5662a] },
  // 鳥⿃⻦鸟
  { number: 196, name: "鳥", glyph_ids: [0x01391, 0x56623] },
  // 鹵⿄⻧卤
  { number: 197, name: "鹵", glyph_ids: [0x1940a, 0x1980f] },
  // 鹿⿅
  { number: 198, name: "鹿", glyph_ids: [0x5160b, 0x51609] },
  // 麥⿆⻨麦
  { number: 199, name: "麥", glyph_ids: [0x22300, 0x23703] },
  // 麻⿇
  { number: 200, name: "麻", glyph_ids: [0x35714, 0x35719] },
  // 黃⿈⻩黄
  { number: 201, name: "黃", glyph_ids: [0x01933, 0x66503, 0x01a20, 0x01a21] },
  // 黍⿉
  { number: 202, name: "黍", glyph_ids: [0x73639] },
  // 黑⿊
  { number: 203, name: "黑", glyph_ids: [0x56727] },
  // 黹⿋
  { number: 204, name: "黹", glyph_ids: [0x0c910, 0x02a1a] },
  // 黽⿌⻪黾
  { number: 205, name: "黽", glyph_ids: [0x00c00, 0x00c01, 0x1e45f] },
  // 鼎⿍
  { number: 206, name: "鼎", glyph_ids: [0x6d678] },
  // 鼓⿎
  { number: 207, name: "鼓", glyph_ids: [0x41800] },
  // 鼠⿏鼡
  { number: 208, name: "鼠", glyph_ids: [0x86618, 0x2a423, 0x86616] },
  // 鼻⿐
  { number: 209, name: "鼻", glyph_ids: [0x84705, 0x84706] },
  // 齊⿑⻫⻬齐斉
  { number: 210, name: "齊", glyph_ids: [0x4330c, 0x43105, 0x08b36] },
  // 齒⿒⻭⻮齿歯
  { number: 211, name: "齒", glyph_ids: [0x4d723, 0x4d324, 0x4da10] },
  // 龍⿓⻯⻰龙竜
  { number: 212, name: "龍", glyph_ids: [0x00435, 0x75416, 0x75a0a, 0x75a14] },
  // 龜⿔⻱⻲⻳龟亀
  {
    number: 213,
    name: "龜",
    glyph_ids: [0x0064a, 0x00f02, 0x12f32, 0x1282d, 0x12f35],
  },
  // 龠⿕
  { number: 214, name: "龠", glyph_ids: [0x01f82] },
];

/** 同一实际字形可能同时对应多个部首；保留歧义，不以表的行序消歧。 */
export function 创建部首反查表(
  部首表: readonly 康熙部首定义[] = 康熙部首表,
): ReadonlyMap<number, readonly number[]> {
  const 反查表 = new Map<number, number[]>();
  for (const 部首 of 部首表) {
    for (const id of 部首.glyph_ids) {
      const 编号 = 反查表.get(id) ?? [];
      if (!编号.includes(部首.number)) 编号.push(部首.number);
      反查表.set(id, 编号);
    }
  }
  return 反查表;
}
