import {
  ModalForm,
  ProDescriptions,
  ProForm,
  ProFormDependency,
  ProFormDigit,
  ProFormGroup,
  ProFormSelect,
} from "@ant-design/pro-components";
import { Button, Form, Space, Switch, notification } from "antd";
import { metaheuristicAtom, useAtom } from "~/atoms";
import { Rule, Solver } from "~/lib/config";

export default function () {
  const [metaheuristic, setMetaheuristic] = useAtom(metaheuristicAtom);
  const parameters = metaheuristic.parameters;
  const [form] = Form.useForm<Solver>();
  const defaultParams = {
    t_max: 1.0,
    t_min: 1.0e-6,
    steps: 10000,
  };
  return (
    <>
      <ProDescriptions column={4}>
        <ProDescriptions.Item label="算法">退火算法</ProDescriptions.Item>
        {parameters ? (
          <>
            <ProDescriptions.Item label="最高温">
              {parameters.t_max ?? defaultParams.t_max}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="最低温">
              {parameters.t_min ?? defaultParams.t_min}
            </ProDescriptions.Item>
            <ProDescriptions.Item label="步数">
              {parameters.steps ?? defaultParams.steps}
            </ProDescriptions.Item>
          </>
        ) : (
          <ProDescriptions.Item label="运行时间（分钟）">
            {metaheuristic.runtime ?? 10}
          </ProDescriptions.Item>
        )}
      </ProDescriptions>
      <ModalForm<Solver>
        title="求解算法"
        form={form}
        trigger={<Button>编辑细节</Button>}
        initialValues={metaheuristic}
        onFinish={async (values) => {
          setMetaheuristic(values);
          return true;
        }}
        onValuesChange={(_, values) => setMetaheuristic(values)}
      >
        <ProFormGroup>
          <ProFormSelect
            name="algorithm"
            label="算法"
            options={[{ label: "退火算法", value: "SimulatedAnnealing" }]}
            rules={[{ required: true }]}
          />
          <ProFormDigit label="保存进度" name="report_after" />
          <ProFormDependency name={["parameters"]}>
            {({ parameters }) => (
              <Form.Item label="自动调参">
                <Switch
                  checked={parameters === undefined}
                  onChange={(value) => {
                    form.setFieldValue(
                      "parameters",
                      value ? undefined : defaultParams,
                    );
                    form.setFieldValue("runtime", value ? 10 : undefined);
                  }}
                />
              </Form.Item>
            )}
          </ProFormDependency>
        </ProFormGroup>
        <ProFormGroup title="移动方式">
          <ProFormDigit
            label="随机移动"
            name={["search_method", "random_move"]}
          />
          <ProFormDigit
            label="随机交换"
            name={["search_method", "random_swap"]}
          />
        </ProFormGroup>
        <ProFormDependency name={["parameters"]}>
          {({ parameters }) =>
            parameters === undefined ? (
              <ProFormDigit label="运行时间" name="runtime" />
            ) : (
              <ProFormGroup title="参数">
                <ProFormDigit label="最高温" name={["parameters", "t_max"]} />
                <ProFormDigit label="最低温" name={["parameters", "t_min"]} />
                <ProFormDigit label="步数" name={["parameters", "steps"]} />
              </ProFormGroup>
            )
          }
        </ProFormDependency>
      </ModalForm>
    </>
  );
}
