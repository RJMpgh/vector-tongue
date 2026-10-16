"""Integration checks using real FastMCP protocol discovery and tool calls."""
import asyncio
import os
import pathlib
import sys
import unittest
from unittest.mock import patch
from fastmcp import Client
from server import mcp

class MCPTests(unittest.IsolatedAsyncioTestCase):
    async def test_discovery_and_schema(self):
        async with Client(mcp) as client:
            tools = {t.name: t for t in await client.list_tools()}
            self.assertEqual(set(tools), {'audit_tool_call','list_audit_contracts'})
            self.assertTrue(tools['audit_tool_call'].annotations.readOnlyHint)
            self.assertIn('status', tools['audit_tool_call'].outputSchema['properties'])
            result = await client.call_tool('list_audit_contracts', {})
            self.assertEqual(len(result.data['contracts']), 2)

    async def test_schema_precedes_model_load(self):
        with patch('server.get_auditor', side_effect=AssertionError('Must not load')) as loader:
            async with Client(mcp) as client:
                result = await client.call_tool('audit_tool_call', dict(user_intent='update',service='crm',action='crm_update',payload={'discount_tier':'free'}))
                self.assertEqual(result.structured_content['status'], 'FAIL_SCHEMA')
                loader.assert_not_called()

    async def test_missing_model_is_not_a_pass(self):
        with patch('server.get_auditor', side_effect=RuntimeError('private path')):
            async with Client(mcp) as client:
                result = await client.call_tool('audit_tool_call', dict(user_intent='read issue 10',service='github',action='get_issue',payload=dict(owner='RJMpgh',repo='vector-tongue',issue_number=10)))
                self.assertEqual(result.structured_content['status'],'NOT_MEASURED')
                self.assertEqual(result.structured_content['schema_status'],'VALID')
                self.assertNotIn('private path',str(result.structured_content))

    async def test_real_stdio_process(self):
        from fastmcp.client.transports import StdioTransport
        server = pathlib.Path(__file__).resolve().parents[1] / 'server.py'
        transport = StdioTransport(command=sys.executable, args=[str(server)])
        async with Client(transport, timeout=15) as client:
            result = await client.call_tool('list_audit_contracts', {})
            self.assertEqual(result.data['execution'],'DISABLED')

if __name__ == '__main__': unittest.main()
