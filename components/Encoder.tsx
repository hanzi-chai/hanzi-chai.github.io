import React, { useContext, useEffect, useRef } from "react";
import { Graph, Node } from "@antv/x6";
import { Options } from "@antv/x6/lib/graph/options";
import { register } from "@antv/x6-react-shape";
import { Col, Dropdown, Row } from "antd";
import { Snapline } from "@antv/x6-plugin-snapline";
import styled from "styled-components";
import { Stencil } from "@antv/x6-plugin-stencil";
import { ConfigContext } from "./Context";

const unit = 32;

const CustomComponent = ({ node }: { node: Node }) => {
  const label = node.prop("label");
  return (
    <Dropdown
      menu={{
        items: [
          {
            key: "copy",
            label: "复制",
          },
          {
            key: "paste",
            label: "粘贴",
          },
          {
            key: "delete",
            label: "删除",
          },
        ],
      }}
      trigger={["contextMenu"]}
    >
      <CustomNode>{label}</CustomNode>
    </Dropdown>
  );
};

const CustomNode = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  background-color: #fff;
  border: 1px solid #8f8f8f;
  border-radius: 6px;

  span {
    display: inline-block;
    width: 100%;
    height: 100%;
  }
`;

register({
  shape: "element",
  width: unit * 3,
  height: unit,
  component: CustomComponent,
  ports: {
    groups: {
      right: {
        position: "right",
        attrs: {
          circle: {
            magnet: true,
            stroke: "#8f8f8f",
            r: 5,
          },
        },
      },
      left: {
        position: "left",
        attrs: {
          circle: {
            magnet: true,
            stroke: "#8f8f8f",
            r: 5,
          },
        },
      },
    },
  },
});

register({
  shape: "start",
  width: unit * 2,
  height: unit * 2,
  component: CustomComponent,
});

const options: Partial<Options.Manual> = {
  panning: {
    enabled: true,
    eventTypes: ["leftMouseDown", "mouseWheel"],
  },
  mousewheel: {
    enabled: true,
    modifiers: "ctrl",
    factor: 1.1,
    maxScale: 1.5,
    minScale: 0.5,
  },
  grid: {
    size: 16,
    visible: true,
    type: "mesh",
    args: {
      thickness: 1,
      color: "#ddd",
    },
  },
  background: {
    color: "#F2F7FA",
  },
};

const data = {
  nodes: [
    {
      id: "node1",
      shape: "element",
      x: 0,
      y: 0,
      label: "+",
      ports: {
        items: [{ id: "port1", group: "right" }],
      },
    },
  ],
};

const Wrapper = styled(Row)`
  user-select: none;
  margin-top: 32px;
  gap: 32px;
`;

const GraphEditor = styled(Col)`
  height: 640px;
  border-radius: 8px;
  box-shadow:
    0 12px 5px -10px rgb(0 0 0 / 10%),
    0 0 4px 0 rgb(0 0 0 / 10%);
`;

const NodeLibrary = styled(Col)``;

const Encoder = () => {
  const { elements } = useContext(ConfigContext);
  const groups = elements.map(({ type }, index) => `元素 ${index}: ${type}`);
  const graphEditor = useRef(null as HTMLDivElement | null);
  const nodeLibrary = useRef(null as HTMLDivElement | null);

  useEffect(() => {
    const graph = new Graph({
      container: graphEditor.current as HTMLDivElement,
      ...options,
    });

    // graph.use(new Snapline({ enabled: true }));
    graph.fromJSON(data);
    graph.centerContent();

    const stencil = new Stencil({
      title: "节点库",
      target: graph,
      stencilGraphHeight: 0,
      layoutOptions: { columnWidth: 200 },
      groups: groups.map((x) => ({ name: x })),
    });
    console.log(groups);

    nodeLibrary.current?.appendChild(stencil.container);

    for (const [index, element] of elements.entries()) {
      const name = groups[index];
      const list = [];
      for (const nodename of element.nodes) {
        console.log(nodename);
        const node = graph.createNode({
          shape: "element",
          label: nodename,
          ports: {
            items: [
              { id: "test", group: "left" },
              { id: "right", group: "right" },
            ],
          },
        });
        list.push(node);
      }
      stencil.load(list, name);
    }
  }, [elements]);

  return (
    <Wrapper gutter={32}>
      <NodeLibrary className="gutter-row" span={6} ref={nodeLibrary} />
      <GraphEditor className="gutter-row" span={12} ref={graphEditor} />
    </Wrapper>
  );
};

export default Encoder;
