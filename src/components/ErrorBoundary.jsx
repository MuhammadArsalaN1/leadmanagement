import React from "react";

export default class ErrorBoundary extends React.Component {

  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.log("TodoBoard Crash:", error, info);
  }

  render() {

    if (this.state.hasError) {
      return (
        <div style={{
          padding:20,
          background:"#fee2e2",
          border:"1px solid #fecaca",
          borderRadius:10
        }}>
          <h3>Todo Board Crashed</h3>

          <pre style={{fontSize:12}}>
            {String(this.state.error)}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
