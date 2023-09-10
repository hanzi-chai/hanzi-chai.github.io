import React, { useContext } from "react";
import { Input } from "antd";
import { ConfigContext, DispatchContext } from "./Context";

const Label = ({ label }: {label: string}) => <label style={{width: "120px"}}>
  { label }
</label>

const InfoInput = ({ label, field, value }: { label: string, field: string, value: string }) => {
  const dispatch = useContext(DispatchContext);
  return <div style={{display: "flex", alignItems: "center"}}>
    <Label label={label}/>
    <Input placeholder={label} value={value} onChange={(e) => dispatch({ type: "info", content: { [field]: e.target.value }}) }/>
  </div>
}

const Info: React.FC = () => {
  const config = useContext(ConfigContext);
  return (
    <div style={{width: "300px", margin: "auto"}}>
      <InfoInput label="方案 ID" field="id" value={config.info.id} />
      <InfoInput label="方案名称" field="name" value={config.info.name} />
    </div>
  )
};

export default Info;
