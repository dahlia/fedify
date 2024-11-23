import type { LogRecord } from "@logtape/logtape";
import { getStatusText } from "@poppanator/http-constants";
import type { FC, PropsWithChildren } from "hono/jsx";
import { getSingletonHighlighter } from "shiki";
import type { ActivityEntry } from "./entry.ts";
import {
  renderActivity,
  renderRawActivity,
  renderRequest,
  renderResponse,
} from "./rendercode.ts";

interface LayoutProps {
  title?: string;
}

const Layout: FC<PropsWithChildren<LayoutProps>> = (
  props: PropsWithChildren<LayoutProps>,
) => {
  return (
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>
          {props.title == null ? "" : <>{props.title} &mdash;{" "}</>}Fedify
          Ephemeral Inbox
        </title>
      </head>
      <body>
        <main class="container mt-3 mb-3">
          {props.children}
        </main>
        <link
          href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
          rel="stylesheet"
          integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
          crossorigin="anonymous"
        >
        </link>
      </body>
    </html>
  );
};

interface TabProps {
  active?: boolean;
  disabled?: boolean;
  label: string;
  badge?: string | number;
  href: string;
}

const Tab: FC<TabProps> = (
  { active, disabled, label, badge, href }: TabProps,
) => {
  return (
    <li class="nav-item">
      {active
        ? (
          <span class="nav-link active" style="cursor: default;">
            {label}
            {badge != null
              ? (
                <>
                  {" "}
                  <span class="badge text-bg-secondary">{badge}</span>
                </>
              )
              : undefined}
          </span>
        )
        : disabled
        ? <span class="nav-link disabled">{label}</span>
        : (
          <a class="nav-link" href={href}>
            {label}
            {badge != null
              ? (
                <>
                  {" "}
                  <span class="badge text-bg-secondary">{badge}</span>
                </>
              )
              : undefined}
          </a>
        )}
    </li>
  );
};

// deno-lint-ignore no-empty-interface
interface TabListProps {
}

const TabList: FC<PropsWithChildren<TabListProps>> = (
  { children }: PropsWithChildren<TabListProps>,
) => {
  return (
    <ul class="nav nav-tabs">
      {children}
    </ul>
  );
};

interface CodeBlockProps {
  language: string;
  code: string;
}

const highlighter = await getSingletonHighlighter({
  themes: ["github-light"],
  langs: ["http", "json"],
});

const CodeBlock: FC<CodeBlockProps> = ({ language, code }: CodeBlockProps) => {
  const result = highlighter.codeToHtml(code, {
    lang: language,
    theme: "github-light",
  });
  return <div dangerouslySetInnerHTML={{ __html: result }} class="m-3" />;
};

interface LogProps {
  log: LogRecord;
}

const Log: FC<LogProps> = (
  { log: { timestamp, category, level, message } }: LogProps,
) => {
  const listClass = level === "debug"
    ? "list-group-item-light"
    : level === "info"
    ? ""
    : level === "warning"
    ? "list-group-item-warning"
    : "list-group-item-danger";
  const time = Temporal.Instant.fromEpochMilliseconds(timestamp);
  return (
    <li class={"list-group-item " + listClass}>
      <div class="d-flex w-100 justify-content-between">
        <p class="mb-1" style="white-space: pre-wrap; word-break: break-word;">
          {message.map((m, i) =>
            i % 2 == 0
              ? m
              : <code>{typeof m === "string" ? m : Deno.inspect(m)}</code>
          )}
        </p>
        <time
          class="text-body-secondary"
          datetime={time.toString()}
          style="flex-shrink: 0;"
        >
          <small>{time.toLocaleString()}</small>
        </time>
      </div>
      <small class="text-body-secondary">
        {category.map((c, i) => i < 1 ? c : <>{" "}/ {c}</>)}
      </small>
    </li>
  );
};

interface LogListProps {
  logs: LogRecord[];
}

const LogList: FC<LogListProps> = ({ logs }: LogListProps) => {
  return (
    <ul class="list-group mt-3">
      {logs.map((log) => <Log log={log} />)}
    </ul>
  );
};

type ActivityEntryTabPage =
  | "request"
  | "response"
  | "raw-activity"
  | "compact-activity"
  | "expanded-activity"
  | "logs";

interface ActivityEntryViewProps {
  entry: ActivityEntry;
  tabPage: ActivityEntryTabPage;
}

const ActivityEntryView: FC<ActivityEntryViewProps> = async (
  { tabPage, entry: { activity, request, response, logs } }:
    ActivityEntryViewProps,
) => {
  return (
    <div>
      <TabList>
        <Tab
          label="Request"
          href="?tab=request"
          active={tabPage === "request"}
        />
        <Tab
          label="Response"
          href="?tab=response"
          disabled={response == null}
          active={tabPage === "response"}
        />
        <Tab
          label="Raw Activity"
          href="?tab=raw-activity"
          disabled={activity == null}
          active={tabPage === "raw-activity"}
        />
        <Tab
          label="Compact Activity"
          href="?tab=compact-activity"
          disabled={activity == null}
          active={tabPage === "compact-activity"}
        />
        <Tab
          label="Expanded Activity"
          href="?tab=expanded-activity"
          disabled={activity == null}
          active={tabPage === "expanded-activity"}
        />
        <Tab
          label="Logs"
          href="?tab=logs"
          badge={logs.length}
          active={tabPage === "logs"}
        />
      </TabList>
      {tabPage === "request" && (
        <div class="tab-page">
          <CodeBlock
            code={await renderRequest(request)}
            language="http"
          />
        </div>
      )}
      {tabPage === "response" && response != null && (
        <div class="tab-page">
          <CodeBlock
            code={await renderResponse(response)}
            language="http"
          />
        </div>
      )}
      {tabPage === "raw-activity" && (
        <div class="tab-page">
          <CodeBlock
            code={await renderRawActivity(request)}
            language="json"
          />
        </div>
      )}
      {tabPage === "compact-activity" && activity != null && (
        <div class="tab-page">
          <CodeBlock
            code={await renderActivity(activity, false)}
            language="json"
          />
        </div>
      )}
      {tabPage === "expanded-activity" && activity != null && (
        <div class="tab-page">
          <CodeBlock
            code={await renderActivity(activity, true)}
            language="json"
          />
        </div>
      )}
      {tabPage === "logs" && (
        <div class="tab-page">
          <LogList logs={logs} />
        </div>
      )}
    </div>
  );
};

export interface ActivityEntryPageProps extends ActivityEntryViewProps {
  idx: number;
}

export const ActivityEntryPage: FC<ActivityEntryPageProps> = (
  { idx, entry, tabPage }: ActivityEntryPageProps,
) => {
  return (
    <Layout title={`Request #${idx}`}>
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item">
            <a href="/r">Inbox</a>
          </li>
          <li class="breadcrumb-item active" aria-current="page">
            Request #{idx} (<time datetime={entry.timestamp.toString()}>
              {entry.timestamp.toLocaleString()}
            </time>)
          </li>
        </ol>
      </nav>

      <ActivityEntryView entry={entry} tabPage={tabPage} />
    </Layout>
  );
};

export interface ActivityListProps {
  entries: ActivityEntry[];
}

const ActivityList: FC<ActivityListProps> = (
  { entries }: ActivityListProps,
) => {
  return (
    <div class="list-group">
      {entries.map((entry, i) => {
        const failed = entry.activity == null || entry.response == null ||
          !entry.response.ok || entry.request.method !== "POST";
        const itemClass = failed ? "list-group-item-danger" : "";
        const url = new URL(entry.request.url);
        return (
          <a
            class={"list-group-item list-group-item-action d-flex w-100 justify-content-between " +
              itemClass}
            href={`/r/${i}`}
          >
            <span>
              Request #{i}:{" "}
              <code>{entry.request.method} {url.pathname + url.search}</code>
              {entry.activity == null ? "" : (
                <>
                  {" "}&middot; <code>{entry.activity.constructor.name}</code>
                </>
              )}
              {entry.response == null ? "" : (
                <>
                  {" "}&rarr;{" "}
                  <code>
                    {entry.response.status} {entry.response.statusText === ""
                      ? getStatusText(entry.response.status)
                      : entry.response.statusText}
                  </code>
                </>
              )}
            </span>
            <time
              class="text-body-secondary"
              timestamp={entry.timestamp.toString()}
            >
              <small>{entry.timestamp.toLocaleString()}</small>
            </time>
          </a>
        );
      }).reverse()}
    </div>
  );
};

export interface ActivityListPageProps extends ActivityListProps {
}

export const ActivityListPage: FC<ActivityListPageProps> = (
  { entries }: ActivityListPageProps,
) => {
  return (
    <Layout>
      <nav aria-label="breadcrumb">
        <ol class="breadcrumb">
          <li class="breadcrumb-item active" aria-current="page">Inbox</li>
        </ol>
      </nav>

      <ActivityList entries={entries} />
    </Layout>
  );
};
