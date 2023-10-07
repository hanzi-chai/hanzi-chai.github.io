import { PropsWithChildren } from "react";
import styled from "styled-components";

const LineWrapper = styled.div`
  display: flex;
  gap: 32px;
  align-items: baseline;
  margin: 16px 0;
`;

const Label = styled.label`
  display: inline-block;
  width: 64px;
`;

const ConfigItem = ({
  label,
  children,
}: PropsWithChildren<{ label: string }>) => {
  return (
    <LineWrapper>
      <Label>{label}</Label>
      {children}
    </LineWrapper>
  );
};

export default ConfigItem;
