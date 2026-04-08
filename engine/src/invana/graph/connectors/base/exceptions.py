class ConnectorError(Exception):
    """Base exception for all connector errors."""


class ConnectionError(ConnectorError):
    """Failed to connect or lost connection."""


class QueryExecutionError(ConnectorError):
    """Query failed during execution."""


class NotSupportedError(ConnectorError):
    """Feature not supported by this connector/vendor."""


class SerializationError(ConnectorError):
    """Failed to serialize/deserialize results."""
