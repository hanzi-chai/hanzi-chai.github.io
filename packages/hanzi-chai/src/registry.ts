import { 默认汇编器, type 汇编器 } from "./assembly.js";
import { 默认部件分析器, type 部件分析器 } from "./component.js";
import { 默认复合体分析器, type 复合体分析器 } from "./compound.js";
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
  汇编器列表: 构造器<汇编器>[];
  筛选器列表: 构造器<筛选器>[];
};

/**
 * 注册表单例，管理各类组件的注册与创建
 */
export class 注册表 {
  private static instance: 注册表;
  private 部件分析器映射: Map<string, 构造器<部件分析器>> = new Map();
  private 复合体分析器映射: Map<string, 构造器<复合体分析器>> = new Map();
  private 拼音分析器映射: Map<string, 构造器<拼音分析器>> = new Map();
  private 汇编器映射: Map<string, 构造器<汇编器>> = new Map();
  private 筛选器映射: Map<string, 构造器<筛选器>> = new Map();
  private constructor({
    部件分析器列表,
    复合体分析器列表,
    拼音分析器列表,
    汇编器列表,
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
    for (const 汇编器 of 汇编器列表) {
      this.汇编器映射.set(汇编器.name, 汇编器);
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
        部件分析器列表: [默认部件分析器],
        复合体分析器列表: [默认复合体分析器],
        拼音分析器列表: [默认拼音分析器],
        汇编器列表: [默认汇编器],
      });
    }

    return 注册表.instance;
  }

  创建部件分析器(名称: string): 部件分析器 | undefined {
    const 构造器 = this.部件分析器映射.get(名称);
    return 构造器 ? new 构造器() : undefined;
  }

  注册部件分析器(部件分析器: 构造器<部件分析器>) {
    this.部件分析器映射.set(部件分析器.name, 部件分析器);
  }

  创建复合体分析器(名称: string): 复合体分析器 | undefined {
    const 构造器 = this.复合体分析器映射.get(名称);
    return 构造器 ? new 构造器() : undefined;
  }

  注册复合体分析器(复合体分析器: 构造器<复合体分析器>) {
    this.复合体分析器映射.set(复合体分析器.name, 复合体分析器);
  }

  创建拼音分析器(名称: string): 拼音分析器 | undefined {
    const 构造器 = this.拼音分析器映射.get(名称);
    return 构造器 ? new 构造器() : undefined;
  }

  注册拼音分析器(拼音分析器: 构造器<拼音分析器>) {
    this.拼音分析器映射.set(拼音分析器.name, 拼音分析器);
  }

  创建汇编器(名称: string): 汇编器 | undefined {
    const 构造器 = this.汇编器映射.get(名称);
    return 构造器 ? new 构造器() : undefined;
  }

  注册汇编器(汇编器: 构造器<汇编器>) {
    this.汇编器映射.set(汇编器.name, 汇编器);
  }

  注册筛选器(筛选器: 构造器<筛选器>) {
    this.筛选器映射.set(筛选器.name, 筛选器);
  }

  创建筛选器(名称: string): 筛选器 | undefined {
    const 构造器 = this.筛选器映射.get(名称);
    return 构造器 ? new 构造器() : undefined;
  }
}
