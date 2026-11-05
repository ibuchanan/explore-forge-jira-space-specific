import { invoke } from "@forge/bridge";
import ForgeReconciler, {
  Button,
  Inline,
  Label,
  SectionMessage,
  Select,
  Spinner,
  Stack,
  Text,
} from "@forge/react";
import React, { useEffect, useState } from "react";

type Project = { key: string; name: string };
type Config = { projectKeys: string[] };
type Reply<T> =
  | { ok: true; value: T }
  | { ok: false; problem: { detail?: string; title?: string } };

const failure = (reply: { problem: { detail?: string; title?: string } }) =>
  reply.problem.detail ?? reply.problem.title ?? "An unexpected error occurred";

const App = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [keys, setKeys] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    error: boolean;
  } | null>(null);

  useEffect(() => {
    (invoke("loadAdmin") as Promise<Reply<Config & { projects: Project[] }>>)
      .then((result) => {
        if (!result.ok) {
          setMessage({ text: failure(result), error: true });
          return;
        }
        setProjects(result.value.projects);
        setKeys(result.value.projectKeys);
      })
      .catch(() => {
        setMessage({
          text: "Could not load configuration. Refresh to try again.",
          error: true,
        });
      });
  }, []);

  const apply = async () => {
    if (keys === null) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = (await invoke("applyConfig", {
        projectKeys: keys,
      })) as Reply<Config>;
      setMessage(
        result.ok
          ? { text: "Project list applied.", error: false }
          : { text: failure(result), error: true },
      );
    } catch {
      setMessage({
        text: "Could not apply configuration. Try again.",
        error: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const options = projects
    .filter(({ key }) => !keys?.includes(key))
    .map(({ key, name }) => ({ label: `${name} (${key})`, value: key }));

  return (
    <Stack space="space.200">
      <Text>
        Choose Jira spaces where the Peek-a-boo issue panel should appear.
        Changes take effect when you apply the list.
      </Text>
      {message && (
        <SectionMessage appearance={message.error ? "error" : "success"}>
          <Text>{message.text}</Text>
        </SectionMessage>
      )}
      {keys === null ? (
        !message && <Spinner label="Loading Jira spaces" />
      ) : (
        <>
          <Label labelFor="project-select">Add a Jira space</Label>
          <Inline space="space.100" alignBlock="end">
            <Select
              inputId="project-select"
              options={options}
              value={options.find(({ value }) => value === selected) ?? null}
              onChange={(option: { value: string } | null) =>
                setSelected(option?.value ?? null)
              }
              placeholder="Select a space"
            />
            <Button
              isDisabled={!selected || saving}
              onClick={() => {
                if (selected) setKeys([...keys, selected]);
                setSelected(null);
              }}
            >
              Add
            </Button>
          </Inline>
          {keys.length === 0 ? (
            <Text>
              No Jira spaces selected. Apply to hide the issue panel everywhere.
            </Text>
          ) : (
            keys.map((key) => (
              <Inline key={key} space="space.100" alignBlock="center">
                <Text>
                  {projects.find((project) => project.key === key)?.name ?? key}{" "}
                  ({key})
                </Text>
                <Button
                  isDisabled={saving}
                  onClick={() => setKeys(keys.filter((item) => item !== key))}
                >
                  Remove
                </Button>
              </Inline>
            ))
          )}
          <Button appearance="primary" isDisabled={saving} onClick={apply}>
            {saving ? "Applying…" : "Apply"}
          </Button>
        </>
      )}
    </Stack>
  );
};

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
