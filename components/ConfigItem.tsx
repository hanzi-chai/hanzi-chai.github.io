import { PropsWithChildren } from "react";
import styled from "styled-components";

const LineWrapper = styled.div`
  display: flex;
  gap: 32px;
  align-items: baseline;
`;

const Label = styled.label``;

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
