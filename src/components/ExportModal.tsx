import React, { useState } from "react";
import Modal from "react-modal";

const DEFAULT_MEETING_THRESHOLD = "10";

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

Modal.setAppElement("#app");

export default function ExportModal({ isOpen, onClose }: ExportModalProps) {
    const tzOffset = (new Date()).getTimezoneOffset() * 60000;
    const date = new Date(Date.now() - tzOffset);
    const defaultStartDate = date.getFullYear() + "-01-01";
    const defaultEndDate = date.toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(defaultStartDate);
    const [endDate, setEndDate] = useState(defaultEndDate);
    const [meetingThreshold, setMeetingThreshold] = useState(DEFAULT_MEETING_THRESHOLD);
    const [sendToSlack, setSendToSlack] = useState(false);
    const [numCheckinsToday, setNumCheckinsToday] = useState(0);
    const [numCheckoutsToday, setNumCheckoutsToday] = useState(0);

    function handleModalOpen() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const date = new Date(Date.now() - tzOffset);
        const defaultStartDate = date.getFullYear() + "-01-01";
        const defaultEndDate = date.toISOString().split("T")[0];

        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setMeetingThreshold(DEFAULT_MEETING_THRESHOLD);
        setSendToSlack(false);

        window.electron.getTodaysStats().then(({ numCheckins, numCheckouts }) => {
            setNumCheckinsToday(numCheckins);
            setNumCheckoutsToday(numCheckouts);
        });
    }

    function handleMeetingThresholdChange(e: React.ChangeEvent<HTMLInputElement>) {
        setMeetingThreshold(e.target.value);
    }

    function decrementMeetingThreshold() {
        setMeetingThreshold(Math.max(Number(meetingThreshold) - 1, 1).toString());
    }

    function incrementMeetingThreshold() {
        setMeetingThreshold(Math.max(Number(meetingThreshold) + 1, 1).toString());
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter;
        const buttonName = (submitter as HTMLButtonElement).name;
        if (buttonName === "export-attendance-report") {
            window.electron.exportAttendanceReport(startDate, endDate, Number(meetingThreshold), sendToSlack);
        } else if (buttonName === "export-meeting-report") {
            window.electron.exportMeetingReport(startDate, endDate, Number(meetingThreshold), sendToSlack);
        } else if (buttonName === "export-checkin-data") {
            window.electron.exportCheckinData(startDate, endDate, Number(meetingThreshold), sendToSlack);
        }
    }

    return <Modal
        className="modal"
        isOpen={isOpen}
        onAfterOpen={handleModalOpen}
        onRequestClose={onClose}
        closeTimeoutMS={250}>
        <button className="modal-close-button" onClick={onClose}>✕</button>
        <h2>Export Reports</h2>
        <div className="modal-row">
            <span className="today-stats">Checkins today: {numCheckinsToday}</span>
            <span className="today-stats">Checkouts today: {numCheckoutsToday}</span>
        </div>
        <form onSubmit={handleSubmit}>
            <div className="modal-row">
                <div><label>Date Range</label></div>
                <div className="date-range">
                    <input
                        className="date-input"
                        name="start-date"
                        type="date"
                        value={startDate}
                        required
                        onChange={(e) => setStartDate(e.target.value)} />
                    {" – "}
                    <input
                        className="date-input"
                        name="end-date"
                        type="date"
                        value={endDate}
                        required
                        onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </div>
            <div className="modal-row">
                <div><label htmlFor="meeting-threshold">Meeting Threshold</label></div>
                <div>Minimum number of unique checkins for a given day to count as a meeting</div>
                <div>
                    <button
                        className="meeting-threshold-button"
                        type="button"
                        onClick={decrementMeetingThreshold}>−</button>
                    <input
                        id="meeting-threshold"
                        name="meeting-threshold"
                        value={meetingThreshold}
                        type="number"
                        min="1"
                        required
                        onChange={handleMeetingThresholdChange} />
                    <button
                        className="meeting-threshold-button"
                        type="button"
                        onClick={incrementMeetingThreshold}>+</button>
                </div>
            </div>
            <div className="modal-row">
                <input
                    type="radio"
                    id="export-to-file"
                    name="export-option"
                    checked={!sendToSlack}
                    onClick={() => setSendToSlack(false)} />
                <label htmlFor="export-to-file">Export to USB drive</label>
                <input
                    type="radio"
                    id="send-to-slack"
                    name="export-option"
                    checked={sendToSlack}
                    onClick={() => setSendToSlack(true)} />
                <label htmlFor="send-to-slack">Send to Kevin on Slack</label>
            </div>
            <div className="modal-row">
                <button
                    name="export-attendance-report"
                    className="modal-submit-button"
                    type="submit">Attendance Report</button>
                <button
                    name="export-meeting-report"
                    className="modal-submit-button"
                    type="submit">Meeting Report</button>
                <button
                    name="export-checkin-data"
                    className="modal-submit-button"
                    type="submit">Checkin Data</button>
            </div>
        </form>
    </Modal>;
}