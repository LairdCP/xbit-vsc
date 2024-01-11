import argparse
import logging
import os


class environment_default(argparse.Action):
    def __init__(self, env_var, required=True, default=None, help=None, **kwargs):
        if not default and env_var:
            if env_var in os.environ:
                default = os.environ[env_var]
        if required and default:
            required = False
        if help is not None:
            help += f" (or environment variable {env_var})"
        super(environment_default, self).__init__(
            default=default, required=required, help=help, **kwargs
        )

    def __call__(self, parser, namespace, values, option_string=None):
        setattr(namespace, self.dest, values)


def logger_setup(script_name, debug=False):
    """
    Configure logging to print date and time.

    Args:
        script_name (str): Name of script that is calling this function.
        debug (bool, optional): Enable debug logging. Defaults to False.
    """
    log_file_name = script_name.replace(".py", ".log")
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.FileHandler(log_file_name), logging.StreamHandler()],
    )

    if debug:
        logging.getLogger().setLevel(logging.DEBUG)

    logging.warning(f"Log level {logging.getLevelName(logging.root.level)}")
        
    return logging.getLogger(__name__)

def logger_get(script_name):
    """
    Convenience function to get logger.

    Args:
        script_name (str): Name of script that is calling this function.
    Returns:
        Logger: Logger for the script.
    """
    return logging.getLogger(script_name)
