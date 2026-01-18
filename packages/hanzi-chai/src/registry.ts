import { 星空键道组装器, 默认组装器, type 组装器 } from "./assembly.js";
import {
  二笔部件分析器,
  默认部件分析器,
  type 部件分析器,
} from "./component.js";
import {
  二笔复合体分析器,
  张码复合体分析器,
  星空键道复合体分析器,
  真码复合体分析器,
  首右复合体分析器,
  默认复合体分析器,
  type 复合体分析器,
} from "./compound.js";
import { 默认拼音分析器, type 拼音分析器 } from "./pinyin.js";
import type { 筛选器 } from "./selector.js";
import {
  根少优先,
  取大优先,
  取小优先,
  全符笔顺,
  连续笔顺,
  非形近根,
  多强字根,
  少弱字根,
  能连不交,
  能散不连,
  同向笔画,
  结构完整,
} from "./selector.js";

interface 构造器<C> {
  new (...args: any[]): C;
  type: string;
}

type 输入 = {
  部件分析器列表: 构造器<部件分析器>[];
  复合体分析器列表: 构造器<复合体分析器>[];
  拼音分析器列表: 构造器<拼音分析器>[];
  组装器列表: 构造器<组装器>[];
  筛选器列表: 构造器<筛选器>[];
};

/**
 * 注册表单例，管理各类组件的注册与创建
 */
class 注册表 {
  private static instance: 注册表;
  private 部件分析器映射: Map<string, 构造器<部件分析器>> = new Map();
  private 复合体分析器映射: Map<string, 构造器<复合体分析器>> = new Map();
  private 拼音分析器映射: Map<string, 构造器<拼音分析器>> = new Map();
  private 组装器映射: Map<string, 构造器<组装器>> = new Map();
  private 筛选器映射: Map<string, 构造器<筛选器>> = new Map();
  private constructor({
    部件分析器列表,
    复合体分析器列表,
    拼音分析器列表,
    组装器列表,
    筛选器列表,
  }: 输入) {
    for (const 筛选器 of 筛选器列表) {
      this.筛选器映射.set(筛选器.name, 筛选器);
    }
    for (const 部件分析器 of 部件分析器列表) {
      this.部件分析器映射.set(部件分析器.name, 部件分析器);
    }
    for (const 复合体分析器 of 复合体分析器列表) {
      this.复合体分析器映射.set(复合体分析器.name, 复合体分析器);
    }
    for (const 拼音分析器 of 拼音分析器列表) {
      this.拼音分析器映射.set(拼音分析器.name, 拼音分析器);
    }
    for (const 组装器 of 组装器列表) {
      this.组装器映射.set(组装器.name, 组装器);
    }
  }

  public static 实例() {
    if (!注册表.instance) {
      注册表.instance = new 注册表({
        筛选器列表: [
          根少优先,
          取大优先,
          取小优先,
          全符笔顺,
          连续笔顺,
          非形近根,
          多强字根,
          少弱字根,
          能连不交,
          能散不连,
          同向笔画,
          结构完整,
        ],
        部件分析器列表: [默认部件分析器, 二笔部件分析器],
        复合体分析器列表: [
          默认复合体分析器,
          二笔复合体分析器,
          真码复合体分析器,
          张码复合体分析器,
          首右复合体分析器,
          星空键道复合体分析器,
        ],
        拼音分析器列表: [默认拼音分析器],
        组装器列表: [默认组装器, 星空键道组装器],
      });
    }

    return 注册表.instance;
  }

  创建部件分析器(名称: string, 配置: any): 部件分析器 | undefined {
    const 构造器 = this.部件分析器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册部件分析器(部件分析器: 构造器<部件分析器>) {
    this.部件分析器映射.set(部件分析器.name, 部件分析器);
  }

  创建复合体分析器(名称: string, 配置: any): 复合体分析器 | undefined {
    const 构造器 = this.复合体分析器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册复合体分析器(复合体分析器: 构造器<复合体分析器>) {
    this.复合体分析器映射.set(复合体分析器.name, 复合体分析器);
  }

  创建拼音分析器(名称: string, 配置: any): 拼音分析器 | undefined {
    const 构造器 = this.拼音分析器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册拼音分析器(拼音分析器: 构造器<拼音分析器>) {
    this.拼音分析器映射.set(拼音分析器.name, 拼音分析器);
  }

  创建组装器(名称: string, 配置: any): 组装器 | undefined {
    const 构造器 = this.组装器映射.get(名称);
    return 构造器 ? new 构造器(配置) : undefined;
  }

  注册组装器(组装器: 构造器<组装器>) {
    this.组装器映射.set(组装器.name, 组装器);
  }

  注册筛选器(筛选器: 构造器<筛选器>) {
    this.筛选器映射.set(筛选器.name, 筛选器);
  }

  创建筛选器(名称: string): 筛选器 | undefined {
    const 构造器 = this.筛选器映射.get(名称);
    return 构造器 ? new 构造器() : undefined;
  }
}

export default 注册表;
