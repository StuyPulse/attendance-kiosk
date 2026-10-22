require("ts-node/register/transpile-only");

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    toISOString,
    getTimestampedFilename,
    getStartDate,
    getToday,
    getCurrentGraduationYears,
} = require("../src/util");

const RealDate = Date;

function withMockedDate(nowIso, timezoneOffsetMinutes, run) {
    const fixedNowMs = RealDate.parse(nowIso);

    class MockDate extends RealDate {
        constructor(...args) {
            if (args.length === 0) {
                super(fixedNowMs);
            } else {
                super(...args);
            }
        }

        static now() {
            return fixedNowMs;
        }

        getTimezoneOffset() {
            return timezoneOffsetMinutes;
        }
    }

    global.Date = MockDate;
    try {
        run();
    } finally {
        global.Date = RealDate;
    }
}

test("toISOString applies local timezone offset and strips trailing Z", () => {
    withMockedDate("2026-10-22T12:00:00.000Z", 300, () => {
        const input = new Date("2026-01-15T12:34:56.789Z");
        assert.equal(toISOString(input), "2026-01-15T07:34:56.789");
    });
});

test("getTimestampedFilename formats deterministic filename", () => {
    withMockedDate("2026-10-22T18:04:05.678Z", 0, () => {
        assert.equal(
            getTimestampedFilename("attendance-report", "csv"),
            "attendance-report-20261022180405.csv",
        );
    });
});

test("getStartDate returns Jan 1 for dates before September", () => {
    withMockedDate("2026-08-15T09:00:00.000Z", 0, () => {
        assert.equal(getStartDate(), "2026-01-01");
    });
});

test("getStartDate returns Sep 1 for dates in September or later", () => {
    withMockedDate("2026-09-15T09:00:00.000Z", 0, () => {
        assert.equal(getStartDate(), "2026-09-01");
    });
});

test("getToday returns local date in YYYY-MM-DD", () => {
    withMockedDate("2026-10-22T23:59:59.000Z", 0, () => {
        assert.equal(getToday(), "2026-10-22");
    });
});

test("getCurrentGraduationYears uses current year before September", () => {
    withMockedDate("2026-04-10T12:00:00.000Z", 0, () => {
        assert.deepEqual(getCurrentGraduationYears(), [2026, 2027, 2028, 2029]);
    });
});

test("getCurrentGraduationYears advances first graduation year in September or later", () => {
    withMockedDate("2026-10-10T12:00:00.000Z", 0, () => {
        assert.deepEqual(getCurrentGraduationYears(), [2027, 2028, 2029, 2030]);
    });
});

