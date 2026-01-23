import type { 组装器, 组装配置 } from "./assembly.js";
import type { 部件分析器 } from "./component.js";
import type { 复合体分析器 } from "./compound.js";
import type { 拼音分析器, 拼音分析配置 } from "./pinyin.js";
import type { 字形分析配置 } from "./repertoire.js";
import type { 筛选器 } from "./selector.js";

interface 构造器<配置, 组件> {
  new (config: 配置): 组件;
  type: string;
}

type 部件分析构造器 = 构造器<字形分析配置, 部件分析器>;
type 复合体分析构造器 = 构造器<字形分析配置, 复合体分析器>;
type 拼音分析构造器 = 构造器<拼音分析配置, 拼音分析器>;
type 组装器构造器 = 构造器<组装配置, 组装器>;
type 筛选器构造器 = 构造器<undefined, 筛选器>;

type 输入 = {
  部件分析器列表: 部件分析构造器[];
  复合体分析器列表: 复合体分析构造器[];
  拼音分析器列表: 拼音分析构造器[];
  组装器列表: 组装器构造器[];
  筛选器列表: 筛选器构造器[];
};

/**
 * 注册表单例，管理各类组件的注册与创建
 */
class 注册表 {
  部件分析器映射: Map<string, 部件分析构造器> = new Map();
  复合体分析器映射: Map<string, 复合体分析构造器> = new Map();
  拼音分析器映射: Map<string, 拼音分析构造器> = new Map();
  组装器映射: Map<string, 组装器构造器> = new Map();
  筛选器映射: Map<string, 筛选器构造器> = new Map();

  constructor({
    部件分析器列表,
    复合体分析器列表,
    拼音分析器列表,
    组装器列表,
    筛选器列表,
  }: 输入) {
    for (const 筛选器 of 筛选器列表) {
      this.筛选器映射.set(筛选器.type, 筛选器);
    }
    for (const 部件分析器 of 部件分析器列表) {
      this.部件分析器映射.set(部件分析器.type, 部件分析器);
    }
    for (const 复合体分析器 of 复合体分析器列表) {
      this.复合体分析器映射.set(复合体分析器.type, 复合体分析器);
    }
    for (const 拼音分析器 of 拼音分析器列表) {
      this.拼音分析器映射.set(拼音分析器.type, 拼音分析器);
    }
    for (const 组装器 of 组装器列表) {
      this.组装器映射.set(组装器.type, 组装器);
    }
  }

  创建部件分析器(名称: string, 配置: 字形分析配置): 部件分析器 | undefined {
    const 构造器 = this.部件分析器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册部件分析器(部件分析器: 部件分析构造器) {
    this.部件分析器映射.set(部件分析器.type, 部件分析器);
  }

  创建复合体分析器(名称: string, 配置: 字形分析配置): 复合体分析器 | undefined {
    const 构造器 = this.复合体分析器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册复合体分析器(复合体分析器: 复合体分析构造器) {
    this.复合体分析器映射.set(复合体分析器.type, 复合体分析器);
  }

  创建拼音分析器(名称: string, 配置: 拼音分析配置): 拼音分析器 | undefined {
    const 构造器 = this.拼音分析器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册拼音分析器(拼音分析器: 拼音分析构造器) {
    this.拼音分析器映射.set(拼音分析器.type, 拼音分析器);
  }

  创建组装器(名称: string, 配置: 组装配置): 组装器 | undefined {
    const 构造器 = this.组装器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册组装器(组装器: 组装器构造器) {
    this.组装器映射.set(组装器.type, 组装器);
  }

  注册筛选器(筛选器: 筛选器构造器) {
    this.筛选器映射.set(筛选器.type, 筛选器);
  }

  创建筛选器(名称: string): 筛选器 | undefined {
    const 构造器 = this.筛选器映射.get(名称);
    return 构造器 ? new 构造器(undefined) : undefined;
  }
}

const 默认输入: 输入 = {
  筛选器列表: [],
  部件分析器列表: [],
  复合体分析器列表: [],
  拼音分析器列表: [],
  组装器列表: [],
};

let 单例: 注册表 | undefined;

export function createRegistry(input?: 输入) {
  return new 注册表(input ?? 默认输入);
}

export function getRegistry() {
  if (!单例) 单例 = createRegistry();
  return 单例;
}

// 测试/调试用：重置单例
export function resetRegistryForTests() {
  单例 = undefined;
}

export { 注册表 };
