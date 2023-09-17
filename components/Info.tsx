import React, { useContext } from "react";
import { Input, Typography } from "antd";
import { ConfigContext, DispatchContext } from "./Context";
import styled from "styled-components";

const Label = styled.label`
  width: 120px;
`;

const InfoLine = styled.div`
  display: flex;
  align-items: center;
  margin: 16px 0;
`;

const InfoInput = ({
  label,
  field,
  value,
}: {
  label: string;
  field: string;
  value: string;
}) => {
  const dispatch = useContext(DispatchContext);
  return (
    <InfoLine>
      <Label>{label}</Label>
      {field === "description" ? (
        <Input.TextArea
          rows={3}
          placeholder={label}
          value={value}
          onChange={(e) =>
            dispatch({ type: "info", content: { [field]: e.target.value } })
          }
        />
      ) : (
        <Input
          placeholder={label}
          value={value}
          onChange={(e) =>
            dispatch({ type: "info", content: { [field]: e.target.value } })
          }
        />
      )}
    </InfoLine>
  );
};

const TempContainer = styled.div`
  width: 300px;
  margin: auto;
`;

const InfoGroup = styled.article``;

const Info: React.FC = () => {
  const config = useContext(ConfigContext);
  return (
    <TempContainer>
      <Typography.Title level={2}>基本信息</Typography.Title>
      <InfoGroup>
        <InfoInput label="方案名称" field="name" value={config.info.name} />
        <InfoInput label="作者" field="author" value={config.info.author} />
        <InfoInput label="版本" field="version" value={config.info.version} />
        <InfoInput
          label="描述"
          field="description"
          value={config.info.description}
        />
      </InfoGroup>
    </TempContainer>
  );
};

export default Info;
