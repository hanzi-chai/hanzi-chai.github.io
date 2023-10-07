import { PhoneticElement } from "./config";

const analyzers = {
  首字母: (p: string) => p[0],
  末字母: (p: string) => p[p.length - 2],
  声: (p: string) => {
    const sm = p.match(/^[bpmfdtnlgkhjqxzcsryw]h?/) || ["零"];
    return sm[0];
  },
  韵: (p: string) => {
    const ym = p.match(/[aeiouv].*(?=\d)/) || ["零"];
    return ym[0];
  },
  调: (p: string) => p.match(/\d/)![0],
} as Record<PhoneticElement, (p: string) => string>;

export default analyzers;
