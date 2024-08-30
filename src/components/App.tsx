import { useState, useEffect } from "react";
import Clock from "./Clock";
import Form from "./Form";
import Logo from "./Logo";
import ExportModal from "./ExportModal";

const PROMPT_SCAN = "Scan student ID or enter OSIS — do not check in for others";
const PROMPT_OTHER_BARCODE = "Wrong barcode — Scan other barcode";
const PROMPT_OK = "OK";

export default function App() {
    const [lastPromptTime, setLastPromptTime] = useState(null);
    const [promptText, setPromptText] = useState(PROMPT_SCAN);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    function handleSubmit() {
        setPromptText(PROMPT_OK);
        setLastPromptTime(new Date());
    }

    function handleWrongBarcode() {
        setPromptText(PROMPT_OTHER_BARCODE);
        setLastPromptTime(new Date());
    }

    useEffect(() => {
        if (lastPromptTime === null) {
            return;
        }

        let promptTime;
        switch (promptText) {
            case PROMPT_OK:
                promptTime = 1500;
                break;
            case PROMPT_OTHER_BARCODE:
                promptTime = 10000;
                break;
        }

        const timeout = setTimeout(() => setPromptText(PROMPT_SCAN), promptTime);
        return () => clearTimeout(timeout);
    }, [lastPromptTime]);

    let footerClass = "footer";
    switch (promptText) {
        case PROMPT_OK:
            footerClass += " ok";
            break;
        case PROMPT_OTHER_BARCODE:
            footerClass += " error";
            break;
    }

    return (
        <>
            <h1 className="title">StuyPulse Attendance Kiosk</h1>
            <div className="row">
                <div className="column">
                    <Logo onTripleClick={() => setExportModalOpen(true)} />
                    <Clock />
                </div>
                <div className="column">
                    <Form
                        isActive={!exportModalOpen}
                        onSuccess={handleSubmit}
                        onWrongBarcode={handleWrongBarcode} />
                </div>
            </div>
            <div className={footerClass}>
                <p className="prompt">{promptText}</p>
            </div>
            <ExportModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)} />
        </>
    );
}
