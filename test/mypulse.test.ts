import test from "node:test";
import assert from "node:assert/strict";
import { Database } from "sqlite";

import { syncToMyPulse } from "../src/mypulse";

type AppendedField = {
    name: string;
    value: unknown;
    filename?: string;
};

class FakeFormData {
    public fields: AppendedField[] = [];

    append(name: string, value: unknown, filename?: string) {
        this.fields.push({ name, value, filename });
    }
}

function withEnv(vars: Record<string, string | undefined>, run: () => Promise<void>) {
    const previous: Record<string, string | undefined> = {};
    for (const key of Object.keys(vars)) {
        previous[key] = process.env[key];
        const next = vars[key];
        if (next === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = next;
        }
    }

    return run().finally(() => {
        for (const key of Object.keys(vars)) {
            const prev = previous[key];
            if (prev === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = prev;
            }
        }
    });
}

test("syncToMyPulse posts CSV reports with expected payload", async () => {
    await withEnv({ MYPULSE_API_KEY: "test-key" }, async () => {
        const reportCalls: Array<{ name: string; startDate: string; endDate: string; threshold: number }> = [];
        const formData = new FakeFormData();
        let fetchRequest: { url: string; init: { method: string; headers: Record<string, string | undefined>; body: unknown } } | null = null;

        await syncToMyPulse({} as unknown as Database, {
            getStartDate: () => "2026-09-01",
            getToday: () => "2026-10-22",
            generateAttendanceReport: async (_db, startDate, endDate, threshold) => {
                reportCalls.push({ name: "attendance", startDate, endDate, threshold });
                return "attendance_csv";
            },
            generateMeetingReport: async (_db, startDate, endDate, threshold) => {
                reportCalls.push({ name: "meetings", startDate, endDate, threshold });
                return "meetings_csv";
            },
            generateCheckinData: async (_db, startDate, endDate, threshold) => {
                reportCalls.push({ name: "checkins", startDate, endDate, threshold });
                return "checkins_csv";
            },
            createFormData: () => formData,
            createBlob: (parts, options) => ({ parts, options }),
            fetch: async (url, init) => {
                fetchRequest = { url, init };
                return {
                    ok: true,
                    status: 200,
                    text: async () => "",
                };
            },
        });

        assert.equal(reportCalls.length, 3);
        for (const call of reportCalls) {
            assert.equal(call.startDate, "2026-09-01");
            assert.equal(call.endDate, "2026-10-22");
            assert.equal(call.threshold, 20);
        }

        assert.ok(fetchRequest);
        assert.equal(fetchRequest?.url, "https://my.stuypulse.com/api/post/scanner");
        assert.equal(fetchRequest?.init.method, "POST");
        assert.equal(fetchRequest?.init.headers.key, "test-key");
        assert.equal(fetchRequest?.init.body, formData);

        assert.equal(formData.fields.length, 3);
        assert.deepEqual(formData.fields.map((field) => field.name), ["attendance", "meetings", "checkins"]);
        assert.deepEqual(formData.fields.map((field) => field.filename), ["attendance.csv", "meetings.csv", "checkins.csv"]);

        const attendanceBlob = formData.fields[0].value as { parts: unknown[]; options: { type: string } };
        assert.deepEqual(attendanceBlob.parts, ["attendance_csv"]);
        assert.equal(attendanceBlob.options.type, "text/csv");
    });
});

test("syncToMyPulse throws with response details when fetch fails", async () => {
    await withEnv({ MYPULSE_API_KEY: "test-key" }, async () => {
        await assert.rejects(
            syncToMyPulse({} as unknown as Database, {
                getStartDate: () => "2026-09-01",
                getToday: () => "2026-10-22",
                generateAttendanceReport: async () => "attendance_csv",
                generateMeetingReport: async () => "meetings_csv",
                generateCheckinData: async () => "checkins_csv",
                createFormData: () => new FakeFormData(),
                createBlob: (parts, options) => ({ parts, options }),
                fetch: async () => ({
                    ok: false,
                    status: 503,
                    text: async () => "service unavailable",
                }),
            }),
            /Failed to sync to MyPulse: 503 service unavailable/,
        );
    });
});

