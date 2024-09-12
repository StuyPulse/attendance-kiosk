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

    function handleModalOpen() {
        const tzOffset = (new Date()).getTimezoneOffset() * 60000;
        const date = new Date(Date.now() - tzOffset);
        const defaultStartDate = date.getFullYear() + "-01-01";
        const defaultEndDate = date.toISOString().split("T")[0];

        setStartDate(defaultStartDate);
        setEndDate(defaultEndDate);
        setMeetingThreshold(DEFAULT_MEETING_THRESHOLD);
        setSendToSlack(false);
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
        if (buttonName === "exportAttendanceReport") {
            window.electron.exportAttendanceReport(startDate, endDate, Number(meetingThreshold), sendToSlack);
        } else if (buttonName === "exportMeetingReport") {
            window.electron.exportMeetingReport(startDate, endDate, Number(meetingThreshold), sendToSlack);
        } else if (buttonName === "exportCheckinData") {
            window.electron.exportCheckinData(startDate, endDate, Number(meetingThreshold), sendToSlack);
        }
    }

    return <Modal
        className="modal"
        isOpen={isOpen}
        onAfterOpen={handleModalOpen}
        onRequestClose={onClose}
        closeTimeoutMS={250}>
        <button className="modalCloseButton" onClick={onClose}>✕</button>
        <h2>Export Reports</h2>
        <form onSubmit={handleSubmit}>
            <div className="modalRow">
                <div><label>Date Range</label></div>
                <div className="dateRange">
                    <input
                        id="startDate"
                        className="dateInput"
                        name="startDate"
                        type="date"
                        value={startDate}
                        required
                        onChange={(e) => setStartDate(e.target.value)} />
                    {" – "}
                    <input
                        id="endDate"
                        className="dateInput"
                        name="endDate"
                        type="date"
                        value={endDate}
                        required
                        onChange={(e) => setEndDate(e.target.value)} />
                </div>
            </div>
            <div className="modalRow">
                <div><label htmlFor="meetingThreshold">Meeting Threshold</label></div>
                <div>Minimum number of unique checkins for a given day to count as a meeting</div>
                <div>
                    <button
                        className="meetingThresholdButton"
                        type="button"
                        onClick={decrementMeetingThreshold}>−</button>
                    <input
                        id="meetingThreshold"
                        name="meetingThreshold"
                        value={meetingThreshold}
                        type="number"
                        min="1"
                        required
                        onChange={handleMeetingThresholdChange} />
                    <button
                        className="meetingThresholdButton"
                        type="button"
                        onClick={incrementMeetingThreshold}>+</button>
                </div>
            </div>
            <div className="modalRow">
                <input
                    type="radio"
                    id="exportToFile"
                    name="exportOption"
                    checked={!sendToSlack}
                    onClick={() => setSendToSlack(false)} />
                <label htmlFor="exportToFile">Export to USB drive</label>
                <input
                    type="radio"
                    id="sendToSlack"
                    name="exportOption"
                    checked={sendToSlack}
                    onClick={() => setSendToSlack(true)} />
                <label htmlFor="sendToSlack">Send to Kevin on Slack</label>
            </div>
            <div className="modalRow">
                <button
                    name="exportAttendanceReport"
                    className="modalSubmitButton"
                    type="submit">Attendance Report</button>
                <button
                    name="exportMeetingReport"
                    className="modalSubmitButton"
                    type="submit">Meeting Report</button>
                <button
                    name="exportCheckinData"
                    className="modalSubmitButton"
                    type="submit">Checkin Data</button>
            </div>
        </form>
    </Modal>;
}