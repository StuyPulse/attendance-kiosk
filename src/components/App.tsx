import { useState, useEffect } from 'react';
import Clock from './Clock';
import Form from './Form';
import logo from "../../assets/Battery-Vector.svg";

const PROMPT_SCAN = "Scan student ID or enter OSIS — do not check in for others";
const PROMPT_OK = "OK";

export default function App() {
    const [lastSubmittedTime, setLastSubmittedTime] = useState(null);
    const [promptText, setPromptText] = useState(PROMPT_SCAN);

    function handleSubmit() {
        setLastSubmittedTime(new Date());
    }

    useEffect(() => {
        if (lastSubmittedTime === null) {
            return;
        }
        setPromptText(PROMPT_OK);
        const timeout = setTimeout(() => setPromptText(PROMPT_SCAN), 1500);
        return () => clearTimeout(timeout);
    }, [lastSubmittedTime]);

    return (
        <>
            <h1 className="title">StuyPulse Attendance Kiosk</h1>
            <div className="row">
                <div className="column">
                    <img className="logo" src={logo} alt="694" />
                    <Clock />
                </div>
                <div className="column">
                    <Form onSubmit={handleSubmit} />
                </div>
            </div>
            <div className={"footer" + (promptText === PROMPT_OK ? " ok" : "")}>
                <p className="prompt">{promptText}</p>
            </div>
        </>
    );
}
